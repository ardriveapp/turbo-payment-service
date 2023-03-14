import BigNumber from "bignumber.js";

import { AR, ARC, ByteCount, Winston } from "../types/types";
import { roundToArweaveChunkSize } from "../utils/roundToChunkSize";
import { ReadThroughArweaveToFiatOracle } from "./oracles/arweaveToFiatOracle";
import { ReadThroughBytesToWinstonOracle } from "./oracles/bytesToWinstonOracle";

export interface PricingService {
  getARCForFiat: (fiat: string, fiatQuantity: number) => Promise<ARC>;
  getARCForBytes: (bytes: ByteCount) => Promise<ARC>;
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

  async getARCForFiat(fiat: string, fiatQuantity: number): Promise<Winston> {
    const fiatPriceOfOneAR =
      await this.arweaveToFiatOracle.getFiatPriceForOneAR(fiat);
    const amountOfARForFiatQuantity = fiatQuantity / fiatPriceOfOneAR;
    return AR.from(
      BigNumber(amountOfARForFiatQuantity.toPrecision(12))
    ).toWinston();
  }

  async getARCForBytes(bytes: ByteCount): Promise<Winston> {
    const chunkSize = roundToArweaveChunkSize(bytes);
    const winston = await this.bytesToWinstonOracle.getWinstonForBytes(
      chunkSize
    );
    return winston;
  }
}
