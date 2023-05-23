import {
  maxJPYPaymentAmount,
  maxUSDPaymentAmount,
  minUSDPaymentAmount,
  turboFeePercentageAsADecimal,
} from "../constants";
import {
  PaymentAmountTooLarge,
  PaymentAmountTooSmall,
} from "../database/errors";
import { Payment } from "../types/payment";
import { ByteCount, WC, Winston } from "../types/types";
import { roundToArweaveChunkSize } from "../utils/roundToChunkSize";
import { ReadThroughArweaveToFiatOracle } from "./oracles/arweaveToFiatOracle";
import { ReadThroughBytesToWinstonOracle } from "./oracles/bytesToWinstonOracle";

export interface PricingService {
  getWCForPayment: (payment: Payment) => Promise<WC>;
  assertMinAndMaxPayment: (payment: Payment) => Promise<void>;
  getWCForBytes: (bytes: ByteCount) => Promise<WC>;
}

export class TurboPricingService implements PricingService {
  private readonly bytesToWinstonOracle: ReadThroughBytesToWinstonOracle;
  private readonly arweaveToFiatOracle: ReadThroughArweaveToFiatOracle;

  constructor({
    bytesToWinstonOracle,
    arweaveToFiatOracle,
  }: {
    bytesToWinstonOracle?: ReadThroughBytesToWinstonOracle;
    arweaveToFiatOracle?: ReadThroughArweaveToFiatOracle;
  }) {
    this.bytesToWinstonOracle =
      bytesToWinstonOracle ?? new ReadThroughBytesToWinstonOracle({});
    this.arweaveToFiatOracle =
      arweaveToFiatOracle ?? new ReadThroughArweaveToFiatOracle({});
  }

  public async assertMinAndMaxPayment(payment: Payment): Promise<void> {
    const fiatPriceOfOneAR =
      await this.arweaveToFiatOracle.getFiatPriceForOneAR(payment.type);

    const { minAmount, maxAmount } = await (async () => {
      if (payment.type === "usd") {
        return {
          minAmount: minUSDPaymentAmount,
          maxAmount: maxUSDPaymentAmount,
        };
      }

      const usdPriceOfOneAR =
        await this.arweaveToFiatOracle.getFiatPriceForOneAR("usd");

      const convertFromUSDLimit = (amount: number) =>
        Math.round((amount / usdPriceOfOneAR) * fiatPriceOfOneAR);

      if (payment.type === "jpy") {
        return {
          minAmount: convertFromUSDLimit(minUSDPaymentAmount),
          maxAmount: maxJPYPaymentAmount,
        };
      }

      return {
        minAmount: convertFromUSDLimit(minUSDPaymentAmount),
        maxAmount: convertFromUSDLimit(maxUSDPaymentAmount),
      };
    })();

    if (payment.amount < minAmount) {
      throw new PaymentAmountTooSmall(payment, minAmount);
    }
    if (payment.amount > maxAmount) {
      throw new PaymentAmountTooLarge(payment, maxAmount);
    }
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

  async getWCForBytes(bytes: ByteCount): Promise<Winston> {
    const chunkSize = roundToArweaveChunkSize(bytes);
    const winston = await this.bytesToWinstonOracle.getWinstonForBytes(
      chunkSize
    );
    return winston;
  }
}
