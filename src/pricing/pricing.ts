/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import BigNumber from "bignumber.js";
import winston from "winston";

import {
  CurrencyLimitation,
  CurrencyLimitations,
  oneARInWinston,
  oneGiBInBytes,
  paymentAmountLimits,
} from "../constants";
import { Database } from "../database/database";
import {
  Adjustment,
  CurrencyType,
  PaymentAdjustment,
  PaymentAdjustmentCatalog,
  PaymentAmount,
  SingleUseCodePaymentCatalog,
  UploadAdjustment,
} from "../database/dbTypes";
import { PaymentAmountTooSmallForPromoCode } from "../database/errors";
import { PostgresDatabase } from "../database/postgres";
import defaultLogger from "../logger";
import { ByteCount, W, Winston } from "../types";
import { Payment } from "../types/payment";
import {
  SupportedPaymentCurrencyTypes,
  supportedPaymentCurrencyTypes,
  zeroDecimalCurrencyTypes,
} from "../types/supportedCurrencies";
import { roundToArweaveChunkSize } from "../utils/roundToChunkSize";
import { ReadThroughArweaveToFiatOracle } from "./oracles/arweaveToFiatOracle";
import { ReadThroughBytesToWinstonOracle } from "./oracles/bytesToWinstonOracle";
import { FinalPrice, NetworkPrice, SubtotalPrice } from "./price";

export type WincForBytesResponse = {
  finalPrice: FinalPrice;
  networkPrice: NetworkPrice;
  adjustments: UploadAdjustment[];
};

export type WincForPaymentResponse = {
  finalPrice: FinalPrice;
  quotedPaymentAmount: PaymentAmount;
  actualPaymentAmount: PaymentAmount;
  adjustments: PaymentAdjustment[];
  inclusiveAdjustments: PaymentAdjustment[];
};

export type WincForPaymentParams = {
  payment: Payment;
  promoCodes?: string[];
  userAddress?: string;
};

export interface PricingService {
  getWCForPayment: (
    params: WincForPaymentParams
  ) => Promise<WincForPaymentResponse>;
  getCurrencyLimitations: () => Promise<CurrencyLimitations>;
  getFiatPriceForOneAR: (currency: CurrencyType) => Promise<number>;
  getFiatRatesForOneGiB: () => Promise<{
    winc: Winston;
    fiat: Record<string, number>;
    adjustments: Adjustment[];
  }>;
  getWCForBytes: (bytes: ByteCount) => Promise<WincForBytesResponse>;
  convertFromUSDAmount: (params: {
    amount: number;
    type: CurrencyType;
  }) => Promise<number>;
}

/** Stripe accepts 8 digits on all currency types except IDR */
const maxStripeDigits = 8;

/** This is a cleaner representation of the actual max: 999_999_99 */
const maxStripeAmount = 990_000_00;

export class TurboPricingService implements PricingService {
  private logger: winston.Logger;
  private readonly bytesToWinstonOracle: ReadThroughBytesToWinstonOracle;
  private readonly arweaveToFiatOracle: ReadThroughArweaveToFiatOracle;
  private readonly paymentDatabase: Database;

  constructor({
    bytesToWinstonOracle,
    arweaveToFiatOracle,
    logger = defaultLogger,
    paymentDatabase,
  }: {
    bytesToWinstonOracle?: ReadThroughBytesToWinstonOracle;
    arweaveToFiatOracle?: ReadThroughArweaveToFiatOracle;
    logger?: winston.Logger;
    paymentDatabase?: Database;
  }) {
    this.logger = logger.child({ class: this.constructor.name });
    this.bytesToWinstonOracle =
      bytesToWinstonOracle ?? new ReadThroughBytesToWinstonOracle({});
    this.arweaveToFiatOracle =
      arweaveToFiatOracle ?? new ReadThroughArweaveToFiatOracle({});
    this.paymentDatabase = paymentDatabase ?? new PostgresDatabase();
  }

  private isWithinTenPercent(value: number, targetValue: number): boolean {
    const percentageDifference =
      (Math.abs(value - targetValue) / targetValue) * 100;
    return percentageDifference <= 10;
  }

  private isBetweenRange(
    values: readonly [number, number, number],
    min: number,
    max: number
  ): boolean {
    return values.every((val) => val >= min && val <= max);
  }

  private countDigits(number: number): number {
    const numberString = number.toFixed();
    return numberString.length;
  }

  private isWithinStripeMaximum(amount: number): boolean {
    return this.countDigits(amount) <= maxStripeDigits;
  }

  public async convertFromUSDAmount({
    amount,
    type,
  }: {
    amount: number;
    type: CurrencyType;
  }): Promise<number> {
    if (type === "usd") {
      return amount;
    }
    const usdPriceOfOneAR = await this.arweaveToFiatOracle.getFiatPriceForOneAR(
      "usd"
    );
    const priceOfOneAR = await this.arweaveToFiatOracle.getFiatPriceForOneAR(
      type
    );
    const isZeroDecimalCurrency = zeroDecimalCurrencyTypes.includes(type);

    return Math.round(
      (amount /
        (isZeroDecimalCurrency ? usdPriceOfOneAR * 100 : usdPriceOfOneAR)) *
        priceOfOneAR
    );
  }

  private async getDynamicCurrencyLimitation(
    curr: string,
    {
      maximumPaymentAmount: currMax,
      minimumPaymentAmount: currMin,
      suggestedPaymentAmounts: currSuggested,
    }: CurrencyLimitation
  ): Promise<CurrencyLimitation> {
    const convertFromUSDLimit = async (amount: number) =>
      await this.convertFromUSDAmount({
        amount,
        type: curr,
      });

    const multiplier = (val: number) => Math.pow(10, this.countDigits(val) - 2);

    const [rawMin, rawMax] = await Promise.all(
      [
        paymentAmountLimits.usd.minimumPaymentAmount,
        paymentAmountLimits.usd.maximumPaymentAmount,
      ].map((amt) => convertFromUSDLimit(amt))
    );

    const dynamicMinimum =
      Math.ceil(rawMin / multiplier(rawMin)) * multiplier(rawMin);

    const dynamicMaximum =
      Math.floor(rawMax / multiplier(rawMax)) * multiplier(rawMax);

    const minimumPaymentAmount = this.isWithinTenPercent(
      dynamicMinimum,
      currMin
    )
      ? currMin
      : dynamicMinimum;

    const maximumPaymentAmount = this.isWithinTenPercent(
      dynamicMaximum,
      currMax
    )
      ? currMax
      : this.isWithinStripeMaximum(dynamicMaximum)
      ? dynamicMaximum
      : maxStripeAmount;

    const dynamicSuggested = [
      minimumPaymentAmount,
      Math.round(minimumPaymentAmount * 2 * multiplier(minimumPaymentAmount)) /
        multiplier(minimumPaymentAmount),
      Math.round(minimumPaymentAmount * 4 * multiplier(minimumPaymentAmount)) /
        multiplier(minimumPaymentAmount),
    ] as const;

    const suggestedPaymentAmounts = this.isBetweenRange(
      currSuggested,
      minimumPaymentAmount,
      maximumPaymentAmount
    )
      ? currSuggested
      : dynamicSuggested;

    this.logger.info(
      "Successfully fetched dynamic prices for supported currencies",
      {
        curr,
        dynamicMinimum,
        dynamicMaximum,
        dynamicSuggested,
      }
    );

    return {
      maximumPaymentAmount,
      minimumPaymentAmount,
      suggestedPaymentAmounts,
    };
  }

  public async getCurrencyLimitations(): Promise<CurrencyLimitations> {
    const limits: Partial<CurrencyLimitations> = {};

    await Promise.all(
      Object.entries(paymentAmountLimits).map(async ([curr, currLimits]) => {
        limits[curr as SupportedPaymentCurrencyTypes] =
          await this.getDynamicCurrencyLimitation(curr, currLimits);
      })
    );

    return limits as CurrencyLimitations;
  }

  public getFiatPriceForOneAR(currency: CurrencyType): Promise<number> {
    return this.arweaveToFiatOracle.getFiatPriceForOneAR(currency);
  }

  public async getFiatRatesForOneGiB() {
    const { adjustments: uploadAdjustments, finalPrice } =
      await this.getWCForBytes(oneGiBInBytes);

    const adjustmentCatalogs: PaymentAdjustmentCatalog[] =
      await this.paymentDatabase.getPaymentAdjustmentCatalogs();

    const fiat: Record<string, number> = {};

    // Calculate fiat prices for one GiB
    await Promise.all(
      supportedPaymentCurrencyTypes.map(async (currency) => {
        const fiatPriceOfOneAR =
          await this.arweaveToFiatOracle.getFiatPriceForOneAR(currency);

        const { paymentAmountAfterAdjustments: fiatPriceAfterAdjustments } =
          await this.applyPaymentAdjustments({
            adjustmentCatalogs,
            paymentAmount: fiatPriceOfOneAR,
            currencyType: currency,
            forRatesEndpoint: true,
          });

        const fiatPriceForOneGiB = finalPrice.winc.times(
          fiatPriceAfterAdjustments
        );

        fiat[currency] = +fiatPriceForOneGiB / oneARInWinston;
      })
    );

    return {
      winc: finalPrice.winc,
      fiat,
      adjustments: uploadAdjustments,
    };
  }

  public async getWCForPayment({
    payment,
    promoCodes = [],
    userAddress,
  }: WincForPaymentParams): Promise<WincForPaymentResponse> {
    const adjustmentCatalogs: PaymentAdjustmentCatalog[] =
      await this.paymentDatabase.getPaymentAdjustmentCatalogs();
    // if there is a userAddress, we can check if they are eligible a promo code
    if (promoCodes.length > 0 && userAddress) {
      const singleUseCodeAdjustmentCatalogs =
        await this.paymentDatabase.getSingleUsePromoCodeAdjustments(
          promoCodes,
          userAddress
        );

      if (singleUseCodeAdjustmentCatalogs.length > 0) {
        for (const catalog of singleUseCodeAdjustmentCatalogs) {
          if (
            (await this.convertFromUSDAmount(payment)) <
            catalog.minimumPaymentAmount
          ) {
            throw new PaymentAmountTooSmallForPromoCode(
              catalog.codeValue,
              catalog.minimumPaymentAmount
            );
          }
          adjustmentCatalogs.push(catalog);
        }
      }
    }

    const exclusiveAdjustments = adjustmentCatalogs.filter(
      (a) => a.exclusivity === "exclusive"
    );

    const {
      adjustments,
      paymentAmountAfterAdjustments: paymentAmountAfterExclusiveAdjustments,
    } = await this.applyPaymentAdjustments({
      adjustmentCatalogs: exclusiveAdjustments,
      paymentAmount: payment.amount,
      currencyType: payment.type,
    });

    const inclusiveAdjustmentCatalogs = adjustmentCatalogs.filter(
      (a) => a.exclusivity === "inclusive"
    );
    const {
      adjustments: inclusiveAdjustments,
      paymentAmountAfterAdjustments: paymentAmountAfterInclusiveAdjustments,
    } = await this.applyPaymentAdjustments({
      adjustmentCatalogs: inclusiveAdjustmentCatalogs,
      paymentAmount: payment.amount,
      currencyType: payment.type,
    });

    const fiatPriceOfOneAR =
      await this.arweaveToFiatOracle.getFiatPriceForOneAR(payment.type);

    const baseWinstonCreditsFromPayment = new Winston(
      BigNumber(
        (zeroDecimalCurrencyTypes.includes(payment.type)
          ? paymentAmountAfterInclusiveAdjustments
          : paymentAmountAfterInclusiveAdjustments / 100) / fiatPriceOfOneAR
      )
        .times(1_000_000_000_000)
        .toFixed(0)
    );

    const finalPrice = new FinalPrice(baseWinstonCreditsFromPayment);
    const quotedPaymentAmount = payment.amount;

    this.logger.info("Calculated adjustments for payment.", {
      quotedPaymentAmount,
      paymentAmountAfterExclusiveAdjustments,
      paymentAmountAfterInclusiveAdjustments,
      finalPrice,
      adjustments,
    });

    return {
      finalPrice,
      actualPaymentAmount: paymentAmountAfterExclusiveAdjustments,
      adjustments,
      inclusiveAdjustments,
      quotedPaymentAmount,
    };
  }

  async getWCForBytes(bytes: ByteCount): Promise<WincForBytesResponse> {
    const chunkSize = roundToArweaveChunkSize(bytes);
    const networkPrice = new NetworkPrice(
      await this.bytesToWinstonOracle.getWinstonForBytes(chunkSize)
    );

    const uploadAdjustmentCatalogs =
      await this.paymentDatabase.getUploadAdjustmentCatalogs();

    const adjustments: UploadAdjustment[] = [];
    let subtotalPrice: SubtotalPrice = new SubtotalPrice(networkPrice.winc);

    for (const {
      catalogId,
      name,
      operator,
      operatorMagnitude,
      description,
    } of uploadAdjustmentCatalogs) {
      const priceBeforeAdjustment = subtotalPrice.winc;

      if (operator === "add") {
        subtotalPrice = subtotalPrice.add(W(operatorMagnitude));
      } else {
        subtotalPrice = subtotalPrice.multiply(operatorMagnitude);
      }

      if (
        subtotalPrice.winc.isNonZeroNegativeInteger() ||
        +subtotalPrice.winc === 0
      ) {
        subtotalPrice = new SubtotalPrice(W(0));
      }

      const adjustmentAmount = subtotalPrice.winc.minus(priceBeforeAdjustment);

      const adjustment: UploadAdjustment = {
        name,
        description,
        operator,
        operatorMagnitude,
        adjustmentAmount,
        catalogId,
      };
      adjustments.push(adjustment);

      if (+subtotalPrice.winc === 0) {
        break;
      }
    }

    this.logger.info("Calculated adjustments for bytes.", {
      bytes,
      originalAmount: networkPrice.toString(),
      adjustments,
    });

    const finalPrice = FinalPrice.fromSubtotal(subtotalPrice);

    return {
      finalPrice,
      networkPrice,
      adjustments,
    };
  }

  private async applyPaymentAdjustments({
    adjustmentCatalogs,
    paymentAmount,
    currencyType,
    forRatesEndpoint = false,
  }: {
    adjustmentCatalogs: (
      | PaymentAdjustmentCatalog
      | SingleUseCodePaymentCatalog
    )[];
    paymentAmount: PaymentAmount;
    currencyType: CurrencyType;
    forRatesEndpoint?: boolean;
  }): Promise<{
    paymentAmountAfterAdjustments: PaymentAmount;
    adjustments: PaymentAdjustment[];
  }> {
    const adjustments = [];
    let paymentAmountAfterAdjustments = paymentAmount;

    for (const catalog of adjustmentCatalogs) {
      const {
        operator,
        operatorMagnitude,
        name: adjustmentName,
        description,
        catalogId,
      } = catalog;
      const amountBeforeAdjustment = paymentAmountAfterAdjustments;

      switch (operator) {
        case "add":
          if (currencyType === "usd") {
            paymentAmountAfterAdjustments += forRatesEndpoint
              ? -operatorMagnitude
              : operatorMagnitude;
          } else {
            paymentAmountAfterAdjustments += await this.convertFromUSDAmount({
              amount: forRatesEndpoint ? -operatorMagnitude : operatorMagnitude,
              type: currencyType,
            });
          }
          break;
        case "multiply":
          // eslint-disable-next-line no-case-declarations
          let calculatedPaymentAmountAfterAdjustments = forRatesEndpoint
            ? paymentAmountAfterAdjustments / operatorMagnitude
            : Math.round(paymentAmountAfterAdjustments * operatorMagnitude);

          if ((catalog as SingleUseCodePaymentCatalog).maximumDiscountAmount) {
            // If theres a max discount amount, we need to check if the calculated amount is greater than the max discount amount
            const calculatedAdjustmentAmount =
              amountBeforeAdjustment - calculatedPaymentAmountAfterAdjustments;
            if (
              (await this.convertFromUSDAmount({
                amount: calculatedAdjustmentAmount,
                type: currencyType,
              })) >
              (catalog as SingleUseCodePaymentCatalog).maximumDiscountAmount
            ) {
              // If the calculated adjustment amount is greater than the max discount amount, we need to instead set the calculated amount subtract the max discount amount
              calculatedPaymentAmountAfterAdjustments =
                paymentAmountAfterAdjustments -
                (await this.convertFromUSDAmount({
                  amount: (catalog as SingleUseCodePaymentCatalog)
                    .maximumDiscountAmount,
                  type: currencyType,
                }));
            }
          }

          paymentAmountAfterAdjustments =
            calculatedPaymentAmountAfterAdjustments;

          break;
        default:
          this.logger.warn("Unknown operator from database!", { operator });
          continue;
      }

      if (paymentAmountAfterAdjustments < 0) {
        paymentAmountAfterAdjustments = 0;
      }

      const adjustment: PaymentAdjustment = {
        adjustmentAmount:
          paymentAmountAfterAdjustments - amountBeforeAdjustment,
        currencyType,
        catalogId,
        description,
        name: adjustmentName,
        operator,
        operatorMagnitude,
      };
      if ((catalog as SingleUseCodePaymentCatalog).codeValue) {
        adjustment["promoCode"] = (
          catalog as SingleUseCodePaymentCatalog
        ).codeValue;
      }
      if ((catalog as SingleUseCodePaymentCatalog).maximumDiscountAmount) {
        adjustment["maxDiscount"] = (
          catalog as SingleUseCodePaymentCatalog
        ).maximumDiscountAmount;
      }

      adjustments.push(adjustment);
    }

    return { adjustments, paymentAmountAfterAdjustments };
  }
}
