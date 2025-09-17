/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
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
  UserAddress,
} from "../database/dbTypes";
import {
  CryptoPaymentTooSmallError,
  PaymentAmountTooSmallForPromoCode,
} from "../database/errors";
import { PostgresDatabase } from "../database/postgres";
import defaultLogger from "../logger";
import {
  ByteCount,
  PositiveFiniteInteger,
  TokenType,
  W,
  Winston,
} from "../types";
import { Payment } from "../types/payment";
import {
  SupportedFiatPaymentCurrencyType,
  supportedFiatPaymentCurrencyTypes,
  zeroDecimalCurrencyTypes,
} from "../types/supportedCurrencies";
import { roundToArweaveChunkSize } from "../utils/roundToChunkSize";
import { ReadThroughBytesToWinstonOracle } from "./oracles/bytesToWinstonOracle";
import { ReadThroughTokenToFiatOracle } from "./oracles/tokenToFiatOracle";
import { FinalPrice, NetworkPrice, SubtotalPrice } from "./price";

export type WincForBytesResponse = {
  finalPrice: FinalPrice;
  networkPrice: NetworkPrice;
  deprecatedChunkBasedNetworkPrice: NetworkPrice;
  adjustments: UploadAdjustment[];
};

export type WincForPaymentResponse = {
  finalPrice: FinalPrice;
  quotedPaymentAmount: PaymentAmount;
  actualPaymentAmount: PaymentAmount;
  adjustments: PaymentAdjustment[];
  inclusiveAdjustments: PaymentAdjustment[];
};

export type WincForCryptoPaymentResponse = {
  finalPrice: FinalPrice;
  actualPaymentAmount: Winston;
  inclusiveAdjustments: PaymentAdjustment[];
  // adjustments: PaymentAdjustment[];
};

export type WincForPaymentParams = {
  payment: Payment;
  promoCodes?: string[];
  userAddress?: string;
};

export type WincForCryptoPaymentParams = {
  amount: Winston;
  token: TokenType;
  /**
   * How to apply fees to the Winc value,
   * `default` means the fee is removed from the Winc value, meaning we're giving the user less Winc than their purchase
   * `invert` means the fee is added to the Winc value, meaning we're giving the user more Winc than their purchase
   * `none` means no fee is applied, meaning we're giving the user the exact Winc value they purchased
   */
  feeMode?: "default" | "invert" | "none";
  // TODO: Promo code support for crypto payments. Since payments happen before we give a quote, we may not be able to support `exclusive` adjustments for crypto payments without sending crypto back to the user
  // userAddress?: string;
  // promoCodes: string[];
};

export interface PricingService {
  getWCForPayment: (
    params: WincForPaymentParams
  ) => Promise<WincForPaymentResponse>;
  getWCForCryptoPayment: (
    params: WincForCryptoPaymentParams
  ) => Promise<WincForCryptoPaymentResponse>;
  getCurrencyLimitations: () => Promise<CurrencyLimitations>;
  getFiatPriceForOneAR: (currency: CurrencyType) => Promise<number>;
  getUSDPriceForOneARAndOneARIO: () => Promise<{
    usdArRate: number;
    usdArioRate: number;
  }>;
  getFiatRatesForOneGiB: () => Promise<{
    winc: Winston;
    fiat: Record<string, number>;
    adjustments: Adjustment[];
  }>;
  getWCForBytes: (
    bytes: ByteCount,
    userAddress?: UserAddress
  ) => Promise<WincForBytesResponse>;
  convertFromUSDAmount: (params: {
    amount: number;
    type: CurrencyType;
  }) => Promise<number>;
  getUsdPriceForCryptoAmount: (params: {
    amount: BigNumber.Value;
    token: TokenType;
  }) => Promise<number>;
  getFiatPriceForCryptoAmount: (params: {
    amount: BigNumber.Value;
    type: SupportedFiatPaymentCurrencyType;
    token: TokenType;
    promoCodes: string[];
    userAddress?: UserAddress;
  }) => Promise<{
    paymentAmount: number;
    quotedPaymentAmount: number;
    adjustments: PaymentAdjustment[];
  }>;
}

/** Stripe accepts 8 digits on all currency types except IDR */
const maxStripeDigits = 8;

/** This is a cleaner representation of the actual max: 999_999_99 */
const maxStripeAmount = 990_000_00;

export class TurboPricingService implements PricingService {
  private logger: winston.Logger;
  private readonly bytesToWinstonOracle: ReadThroughBytesToWinstonOracle;
  private readonly tokenToFiatOracle: ReadThroughTokenToFiatOracle;
  private readonly paymentDatabase: Database;

  constructor({
    bytesToWinstonOracle,
    tokenToFiatOracle,
    logger = defaultLogger,
    paymentDatabase,
  }: {
    bytesToWinstonOracle?: ReadThroughBytesToWinstonOracle;
    tokenToFiatOracle?: ReadThroughTokenToFiatOracle;
    logger?: winston.Logger;
    paymentDatabase?: Database;
  } = {}) {
    this.logger = logger.child({ class: this.constructor.name });
    this.bytesToWinstonOracle =
      bytesToWinstonOracle ?? new ReadThroughBytesToWinstonOracle({});
    this.tokenToFiatOracle =
      tokenToFiatOracle ?? new ReadThroughTokenToFiatOracle({});
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
    const usdPriceOfOneAR = await this.tokenToFiatOracle.getFiatPriceForOneAR(
      "usd"
    );
    const priceOfOneAR = await this.tokenToFiatOracle.getFiatPriceForOneAR(
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
    curr: SupportedFiatPaymentCurrencyType,
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

    this.logger.debug(
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
      stripeMinimumPaymentAmount:
        paymentAmountLimits[curr].stripeMinimumPaymentAmount,
    };
  }

  public async getCurrencyLimitations(): Promise<CurrencyLimitations> {
    const limits: Partial<CurrencyLimitations> = {};

    await Promise.all(
      Object.entries(paymentAmountLimits).map(async ([curr, currLimits]) => {
        limits[curr as SupportedFiatPaymentCurrencyType] =
          await this.getDynamicCurrencyLimitation(
            curr as SupportedFiatPaymentCurrencyType,
            currLimits
          );
      })
    );

    return limits as CurrencyLimitations;
  }

  public getFiatPriceForOneAR(currency: CurrencyType): Promise<number> {
    return this.tokenToFiatOracle.getFiatPriceForOneAR(currency);
  }

  public async getUSDPriceForOneARAndOneARIO(): Promise<{
    usdArRate: number;
    usdArioRate: number;
  }> {
    const usdArRate = await this.tokenToFiatOracle.getUsdPriceForOneToken(
      "arweave"
    );
    const usdArioRate = await this.tokenToFiatOracle.getUsdPriceForOneToken(
      "ario"
    );

    return {
      usdArRate,
      usdArioRate,
    };
  }

  public async getFiatRatesForOneGiB() {
    const { adjustments: uploadAdjustments, finalPrice } =
      await this.getWCForBytes(oneGiBInBytes);

    const adjustmentCatalogs: PaymentAdjustmentCatalog[] = (
      await this.paymentDatabase.getPaymentAdjustmentCatalogs()
    ).filter((cat) => cat.exclusivity === "inclusive");

    const fiat: Record<string, number> = {};

    // Calculate fiat prices for one GiB
    await Promise.all(
      supportedFiatPaymentCurrencyTypes.map(async (currency) => {
        const fiatPriceOfOneAR =
          await this.tokenToFiatOracle.getFiatPriceForOneAR(currency);

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

    const fiatPriceOfOneAR = await this.tokenToFiatOracle.getFiatPriceForOneAR(
      payment.type
    );

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

    this.logger.debug("Calculated adjustments for payment.", {
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

  private tenGiBInBytes = ByteCount(Math.pow(2, 30) * 10);

  async getWCForBytes(
    bytes: ByteCount,
    userAddress?: UserAddress
  ): Promise<WincForBytesResponse> {
    const priceFor10GiB = await this.bytesToWinstonOracle.getWinstonForBytes(
      this.tenGiBInBytes
    );
    const prorationFactor = new BigNumber(bytes.valueOf()).dividedBy(
      this.tenGiBInBytes.valueOf()
    );

    const deprecatedChunkBasedNetworkPrice = new NetworkPrice(
      await this.bytesToWinstonOracle.getWinstonForBytes(
        roundToArweaveChunkSize(bytes)
      )
    );

    const networkPrice = new NetworkPrice(
      priceFor10GiB.times(prorationFactor, "ROUND_CEIL")
    );

    const uploadAdjustmentCatalogs =
      await this.paymentDatabase.getUploadAdjustmentCatalogs();

    const adjustments: UploadAdjustment[] = [];
    let subtotalPrice: SubtotalPrice = new SubtotalPrice(networkPrice.winc);

    const finiteZero = new PositiveFiniteInteger(0);
    for (const {
      catalogId,
      name,
      operator,
      operatorMagnitude,
      description,
      wincLimitation,
      byteCountThreshold,
      limitationInterval,
      limitationIntervalUnit,
    } of uploadAdjustmentCatalogs) {
      if (
        byteCountThreshold.isGreaterThan(finiteZero) &&
        bytes.isGreaterThan(byteCountThreshold)
      ) {
        // if the incoming byte count is above the threshold, this upload adjustment should not be applied
        continue;
      }

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

      if (wincLimitation.isGreaterThan(W(0))) {
        if (!userAddress) {
          // if there is no user to check the limitation against this upload adjustment should not be applied
          subtotalPrice = new SubtotalPrice(priceBeforeAdjustment);
          continue;
        }

        // if the incoming byte count is within the limitation, we need to check if the user has already used this adjustment within the limitation interval
        const wincUsed =
          await this.paymentDatabase.getWincUsedForUploadAdjustmentCatalog({
            userAddress,
            catalogId,
            limitationInterval,
            limitationIntervalUnit,
          });
        if (
          wincUsed
            .plus(adjustmentAmount)
            .times(-1)
            .isGreaterThan(wincLimitation)
        ) {
          // When the used winc plus the incoming winc adjusted is greater than the limitation, this upload adjustment should not be applied
          this.logger.debug(
            "User would or has already exceeded winc limitation, skipping upload adjustment",
            {
              userAddress,
              catalogId,
              wincLimitation,
              wincUsed,
              bytes,
              adjustmentAmount,
            }
          );

          // TODO: We could subsidize partial of the upload to use maximum of the subsidy event for the user

          // We will skip this adjustment, set subtotal back to the price before the adjustment
          subtotalPrice = new SubtotalPrice(priceBeforeAdjustment);
          continue;
        }
      }

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

    const finalPrice = FinalPrice.fromSubtotal(subtotalPrice);

    this.logger.debug("Calculated adjustments for bytes.", {
      bytes,
      networkPrice: networkPrice.toString(),
      finalPrice: finalPrice.toString(),
      deprecatedChunkBasedNetworkPrice:
        deprecatedChunkBasedNetworkPrice.toString(),
      adjustments,
    });

    return {
      finalPrice,
      networkPrice,
      deprecatedChunkBasedNetworkPrice,
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

  private tokensWithoutFees = process.env.TOKENS_WITHOUT_FEES
    ? process.env.TOKENS_WITHOUT_FEES.split(",")
    : ["ario"];

  public async getWCForCryptoPayment({
    amount,
    token,
    feeMode = "default",
  }: WincForCryptoPaymentParams): Promise<WincForCryptoPaymentResponse> {
    if (
      this.tokensWithoutFees.includes(token) &&
      // For ArNS Stripe Purchases -- don't override the feeMode
      feeMode !== "invert"
    ) {
      this.logger.debug(
        "Token is in the tokens without fees list, skipping infra fee calculation"
      );
      feeMode = "none";
    }

    if (token !== "arweave") {
      const tokenRatio = await this.tokenToFiatOracle.getPriceRatioForToken(
        token
      );
      this.logger.debug("Converting crypto payment to AR...", {
        token,
        tokenRatio,
        amount,
      });
      const tokenAmount = baseAmountToTokenAmount(amount.toString(), token);
      const creditAmount = tokenAmount.times(tokenRatio);
      const wincAmount = creditAmount
        .shiftedBy(12)
        .toFixed(0, BigNumber.ROUND_DOWN);

      amount = W(wincAmount);

      if (amount.isLessThan(W(1))) {
        throw new CryptoPaymentTooSmallError();
      }
    }

    const adjustmentCatalogs: PaymentAdjustmentCatalog[] =
      feeMode === "none"
        ? []
        : await this.paymentDatabase.getPaymentAdjustmentCatalogs();
    this.logger.debug("Got adjustment catalogs", {
      adjustmentCatalogs: adjustmentCatalogs.map((a) => ({
        catalogId: a.catalogId,
        name: a.name,
      })),
    });

    const exclusiveAdjustments = adjustmentCatalogs.filter(
      (a) => a.exclusivity === "exclusive"
    );

    if (exclusiveAdjustments.length > 0) {
      this.logger.warn(
        "Exclusive adjustments found for crypto payment. Exclusive adjustments not yet supported, crypto was already sent. Skipping adjustments...",
        {
          exclusiveAdjustments,
        }
      );
    }

    const inclusiveAdjustmentCatalogs = adjustmentCatalogs.filter(
      (a) =>
        a.exclusivity === (token === "kyve" ? "inclusive_kyve" : "inclusive")
    );

    let paymentAmountAfterInclusiveAdjustments = amount;
    const inclusiveAdjustments: PaymentAdjustment[] = [];
    for (const catalog of inclusiveAdjustmentCatalogs) {
      const {
        operator,
        operatorMagnitude: rawOperatorMagnitude,
        name: adjustmentName,
        description,
        catalogId,
      } = catalog;
      const amountBeforeAdjustment = paymentAmountAfterInclusiveAdjustments;

      let operatorMagnitude = rawOperatorMagnitude;
      if (feeMode === "invert") {
        if (operator === "add") {
          operatorMagnitude = -operatorMagnitude;
        }
        if (operator === "multiply" && operatorMagnitude !== 0) {
          operatorMagnitude = 1 / operatorMagnitude;
        }
      }

      switch (operator) {
        case "add":
          // eslint-disable-next-line no-case-declarations
          const operatorMagInUsdCents = operatorMagnitude;
          // eslint-disable-next-line no-case-declarations
          const oneArToUsdCents =
            (await this.tokenToFiatOracle.getFiatPriceForOneAR("usd")) * 100;
          // eslint-disable-next-line no-case-declarations
          const operatorMagnitudeFromUsdCentsToWinston = new Winston(
            BigNumber(operatorMagInUsdCents)
              .dividedBy(oneArToUsdCents)
              .times(1_000_000_000_000)
              .toFixed(0)
          );
          paymentAmountAfterInclusiveAdjustments =
            paymentAmountAfterInclusiveAdjustments.plus(
              operatorMagnitudeFromUsdCentsToWinston
            );

          break;
        case "multiply":
          paymentAmountAfterInclusiveAdjustments =
            paymentAmountAfterInclusiveAdjustments.times(operatorMagnitude);

          break;
        default:
          this.logger.warn("Unknown operator from database!", { operator });
          continue;
      }

      if (paymentAmountAfterInclusiveAdjustments.isLessThan(W(0))) {
        this.logger.debug(
          "Payment amount after inclusive adjustments is less than 0, setting to 0."
        );
        paymentAmountAfterInclusiveAdjustments = W(0);
      }

      const adjustment: PaymentAdjustment = {
        adjustmentAmount: paymentAmountAfterInclusiveAdjustments.minus(
          amountBeforeAdjustment
        ),
        currencyType: token,
        catalogId,
        description,
        name: adjustmentName,
        operator,
        operatorMagnitude,
      };
      this.logger.debug("Applying inclusive adjustment", { adjustment });
      inclusiveAdjustments.push(adjustment);
    }

    const baseWinstonCreditsFromPayment =
      paymentAmountAfterInclusiveAdjustments;

    const finalPrice = new FinalPrice(baseWinstonCreditsFromPayment);

    this.logger.debug("Calculated price and adjustments for crypto payment.", {
      finalPrice,
      actualPaymentAmount: amount,
      inclusiveAdjustments,
    });
    return {
      finalPrice,
      actualPaymentAmount: amount,
      inclusiveAdjustments: inclusiveAdjustments,
    };
  }

  public async getUsdPriceForCryptoAmount({
    amount: baseTokenAmount,
    token,
  }: {
    amount: BigNumber.Value;
    token: TokenType;
  }): Promise<number> {
    const usdPriceForOneToken =
      await this.tokenToFiatOracle.getUsdPriceForOneToken(token);
    const tokenAmount = baseAmountToTokenAmount(baseTokenAmount, token);
    const usdPriceForTokens = tokenAmount.times(usdPriceForOneToken);
    return +usdPriceForTokens.toFixed(2);
  }

  public async getFiatPriceForCryptoAmount({
    amount: baseTokenAmount,
    type,
    token,
    promoCodes,
    userAddress,
  }: {
    amount: BigNumber.Value;
    type: SupportedFiatPaymentCurrencyType;
    token: TokenType;
    promoCodes: string[];
    userAddress?: string;
  }): Promise<{
    paymentAmount: number;
    quotedPaymentAmount: number;
    adjustments: PaymentAdjustment[];
  }> {
    const fiatPriceForOneToken =
      await this.tokenToFiatOracle.getFiatPriceForOneToken(token, type);
    const tokenAmount = baseAmountToTokenAmount(baseTokenAmount, token);
    const fiatPriceForTokens = tokenAmount.times(fiatPriceForOneToken);
    const baseFiatPriceForCryptoAmount = zeroDecimalCurrencyTypes.includes(type)
      ? +fiatPriceForTokens.toFixed(0)
      : +fiatPriceForTokens.shiftedBy(2).toFixed(0);

    let fiatPriceForCryptoAmount = baseFiatPriceForCryptoAmount;
    const adjustments: PaymentAdjustment[] = [];
    if (promoCodes && promoCodes.length > 0) {
      const adjustmentCatalogs: PaymentAdjustmentCatalog[] =
        await this.paymentDatabase.getPaymentAdjustmentCatalogs();
      // if there is a userAddress, we can check if they are eligible for single use promo codes
      if (userAddress) {
        const singleUseCodeAdjustmentCatalogs =
          await this.paymentDatabase.getSingleUsePromoCodeAdjustments(
            promoCodes,
            userAddress
          );

        if (singleUseCodeAdjustmentCatalogs.length > 0) {
          for (const catalog of singleUseCodeAdjustmentCatalogs) {
            if (
              (await this.convertFromUSDAmount({
                amount: baseFiatPriceForCryptoAmount,
                type,
              })) < catalog.minimumPaymentAmount
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
        adjustments: exclusiveAdjustmentsApplied,
        paymentAmountAfterAdjustments: fiatPriceAfterExclusiveAdjustments,
      } = await this.applyPaymentAdjustments({
        adjustmentCatalogs: exclusiveAdjustments,
        paymentAmount: baseFiatPriceForCryptoAmount,
        currencyType: type,
      });
      fiatPriceForCryptoAmount = fiatPriceAfterExclusiveAdjustments;
      adjustments.push(...exclusiveAdjustmentsApplied);
    }

    return {
      paymentAmount: fiatPriceForCryptoAmount,
      quotedPaymentAmount: baseFiatPriceForCryptoAmount,
      adjustments,
    };
  }
}

const ukyveExponent = 6;
const lamportExponent = 9;
const winstonExponent = 12;
const weiExponent = 18;
const mARIOExponent = 6;

export const tokenExponentMap = {
  arweave: winstonExponent,
  solana: lamportExponent,
  ed25519: lamportExponent,
  kyve: ukyveExponent,
  ethereum: weiExponent,
  matic: weiExponent,
  pol: weiExponent,
  "base-eth": weiExponent,
  ario: mARIOExponent,
};

export function baseAmountToTokenAmount(
  amount: BigNumber.Value,
  token: TokenType
): BigNumber {
  return BigNumber(amount).shiftedBy(-tokenExponentMap[token]);
}
