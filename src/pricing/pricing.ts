import { turboFeePercentageAsADecimal } from "../constants";
import { Payment } from "../types/payment";
import { ByteCount, WC, Winston } from "../types/types";
import { roundToArweaveChunkSize } from "../utils/roundToChunkSize";
import { ReadThroughArweaveToFiatOracle } from "./oracles/arweaveToFiatOracle";
import { ReadThroughBytesToWinstonOracle } from "./oracles/bytesToWinstonOracle";

export interface PricingService {
  getWCForPayment: (payment: Payment) => Promise<WC>;
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

  async getWCForPayment(payment: Payment): Promise<Winston> {
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
