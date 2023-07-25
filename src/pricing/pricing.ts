import winston from "winston";

import {
  CurrencyLimitation,
  CurrencyLimitations,
  paymentAmountLimits,
  turboFeePercentageAsADecimal,
} from "../constants";
import { Database } from "../database/database";
import { Adjustment, CurrencyType, UserAddress } from "../database/dbTypes";
import { PostgresDatabase } from "../database/postgres";
import defaultLogger from "../logger";
import { ByteCount, PositiveFiniteInteger, WC, Winston } from "../types";
import { Payment } from "../types/payment";
import {
  SupportedPaymentCurrencyTypes,
  zeroDecimalCurrencyTypes,
} from "../types/supportedCurrencies";
import { roundToArweaveChunkSize } from "../utils/roundToChunkSize";
import { ReadThroughArweaveToFiatOracle } from "./oracles/arweaveToFiatOracle";
import { ReadThroughBytesToWinstonOracle } from "./oracles/bytesToWinstonOracle";

export type WincForBytesResponse = {
  winc: WC;
  adjustments: Adjustment[];
};

export interface PricingService {
  getWCForPayment: (payment: Payment) => Promise<WC>;
  getCurrencyLimitations: () => Promise<CurrencyLimitations>;
  getFiatPriceForOneAR: (currency: CurrencyType) => Promise<number>;
  getWCForBytes: (
    bytes: ByteCount,
    userAddress?: UserAddress
  ) => Promise<WincForBytesResponse>;
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
    paymentDatabase,
    logger = defaultLogger,
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

  private async getDynamicCurrencyLimitation(
    curr: string,
    {
      maximumPaymentAmount: currMax,
      minimumPaymentAmount: currMin,
      suggestedPaymentAmounts: currSuggested,
    }: CurrencyLimitation,
    usdPriceOfOneAR: number
  ): Promise<CurrencyLimitation> {
    const currencyPriceOfOneAr =
      await this.arweaveToFiatOracle.getFiatPriceForOneAR(curr);

    const convertFromUSDLimit = (amount: number) =>
      (amount /
        (zeroDecimalCurrencyTypes.includes(curr)
          ? // Use the DOLLAR value for zero decimal currencies rather than CENT value
            usdPriceOfOneAR * 100
          : usdPriceOfOneAR)) *
      currencyPriceOfOneAr;

    const multiplier = (val: number) => Math.pow(10, this.countDigits(val) - 2);

    const rawMin = convertFromUSDLimit(
      paymentAmountLimits.usd.minimumPaymentAmount
    );
    const dynamicMinimum =
      Math.ceil(rawMin / multiplier(rawMin)) * multiplier(rawMin);

    const rawMax = convertFromUSDLimit(
      paymentAmountLimits.usd.maximumPaymentAmount
    );
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
    const usdPriceOfOneAR = await this.arweaveToFiatOracle.getFiatPriceForOneAR(
      "usd"
    );

    const limits: Partial<CurrencyLimitations> = {};

    await Promise.all(
      Object.entries(paymentAmountLimits).map(async ([curr, currLimits]) => {
        limits[curr as SupportedPaymentCurrencyTypes] =
          await this.getDynamicCurrencyLimitation(
            curr,
            currLimits,
            usdPriceOfOneAR
          );
      })
    );

    return limits as CurrencyLimitations;
  }

  public async getFiatPriceForOneAR(currency: CurrencyType): Promise<number> {
    return await this.arweaveToFiatOracle.getFiatPriceForOneAR(currency);
  }

  public async getWCForPayment(payment: Payment): Promise<Winston> {
    const fiatPriceOfOneAR =
      await this.arweaveToFiatOracle.getFiatPriceForOneAR(payment.type);

    const baseWinstonCreditsFromPayment = payment.winstonCreditAmountForARPrice(
      fiatPriceOfOneAR,
      turboFeePercentageAsADecimal
    );

    return baseWinstonCreditsFromPayment;
  }

  // async getWCForBytes(bytes: ByteCount): Promise<GetWincForBytesResult> {
  //   const chunkSize = roundToArweaveChunkSize(bytes);
  //   const winc = await this.bytesToWinstonOracle.getWinstonForBytes(chunkSize);

  //   return {
  //     winc: adjustedWinc.isNonZeroNegativeInteger()
  //       ? new Winston(0) // Return as 0 if negative value is calculated so we don't pay users to upload
  //       : adjustedWinc,
  //   };
  // }

  async getWCForBytes(
    bytes: ByteCount,
    userAddress?: UserAddress
  ): Promise<WincForBytesResponse> {
    const chunkSize = roundToArweaveChunkSize(bytes);
    const wincFromOracle = await this.bytesToWinstonOracle.getWinstonForBytes(
      chunkSize
    );

    // const adjustmentMultiplier =
    //   (process.env.SUBSIDIZED_WINC_PERCENTAGE
    //     ? +process.env.SUBSIDIZED_WINC_PERCENTAGE
    //     : 0) / 100;
    // // round down the subsidy amount to closest full integer for the subsidy amount
    // const adjustmentAmount = winston.times(adjustmentMultiplier);

    // // TODO: pull adjustments from database
    // const adjustments: Adjustment[] = [
    //   {
    //     name: "FWD Research July 2023 Subsidy",
    //     description: `A ${
    //       adjustmentMultiplier * 100
    //     }% discount for uploads over 500KiB`,
    //     operator: "multiply",
    //     value: adjustmentMultiplier,
    //     // We DEDUCT the adjustment in this flow so we give the inverse by multiplying by negative one
    //     adjustmentAmount: adjustmentAmount.times(-1),
    //   },
    // ];

    const currentUploadAdjustments = (
      await this.paymentDatabase.getCurrentUploadAdjustments(userAddress)
    ).sort((a, b) => a.priority - b.priority);
    this.logger.info(currentUploadAdjustments.toString());

    let adjustedWinc = wincFromOracle;

    const adjustments: Adjustment[] = [];

    for (const adjustment of currentUploadAdjustments) {
      const { description, id, name, operator, value, threshold } = adjustment;

      if (threshold) {
        const { unit: thresholdUnit, operator: thresholdOperator } = threshold;
        if (thresholdUnit === "bytes") {
          const thresholdValue = new PositiveFiniteInteger(+threshold.value);

          if (
            thresholdOperator === "less_than" &&
            bytes.isGreaterThan(thresholdValue)
          ) {
            continue;
          }
          if (
            thresholdOperator === "greater_than" &&
            thresholdValue.isGreaterThan(bytes)
          ) {
            continue;
          }
        }
        if (thresholdUnit === "winc") {
          const thresholdValue = new Winston(threshold.value);

          if (
            thresholdOperator === "less_than" &&
            adjustedWinc.isGreaterThan(thresholdValue)
          ) {
            continue;
          }
          if (
            thresholdOperator === "greater_than" &&
            thresholdValue.isGreaterThan(adjustedWinc)
          ) {
            continue;
          }
        }
      }

      if (operator === "multiply") {
        // Apply the "upload" and "multiply" adjustment as a discount or subsidy
        const adjustmentAmount = adjustedWinc.times(value);
        adjustedWinc = adjustedWinc.minus(adjustmentAmount);

        adjustments.push({
          id,
          name,
          description,
          adjustmentAmount,
          operator,
          value,
        });
      }
    }
    this.logger.info("Calculated adjustments for bytes.", {
      bytes,
      userAddress,
      originalAmount: wincFromOracle.toString(),
      adjustments,
    });
    return {
      winc: adjustedWinc,
      adjustments,
    };
  }
}
