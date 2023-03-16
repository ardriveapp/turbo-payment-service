import BigNumber from "bignumber.js";

import { AR, ByteCount, WC, Winston } from "../types/types";
import { roundToArweaveChunkSize } from "../utils/roundToChunkSize";
import { ReadThroughArweaveToFiatOracle } from "./oracles/arweaveToFiatOracle";
import { ReadThroughBytesToWinstonOracle } from "./oracles/bytesToWinstonOracle";

export interface PricingService {
  getWCForFiat: (fiat: string, fiatQuantity: number) => Promise<WC>;
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

  async getWCForFiat(fiat: string, fiatQuantity: number): Promise<Winston> {
    const fiatPriceOfOneAR =
      await this.arweaveToFiatOracle.getFiatPriceForOneAR(fiat);
    const amountOfARForFiatQuantity = fiatQuantity / fiatPriceOfOneAR;
    // AR only accepts 12 decimal places, but we have more from the above calculation.
    // We need to round to 12 decimal places to avoid errors.
    // toPrecision rounds up by default so this is a workaround to round down to ensure we don't overpay.
    const ar =
      Math.floor(amountOfARForFiatQuantity * 1000000000000) / 1000000000000;
    return AR.from(BigNumber(ar)).toWinston();
  }

  async getWCForBytes(bytes: ByteCount): Promise<Winston> {
    const chunkSize = roundToArweaveChunkSize(bytes);
    const winston = await this.bytesToWinstonOracle.getWinstonForBytes(
      chunkSize
    );
    return winston;
  }
}
