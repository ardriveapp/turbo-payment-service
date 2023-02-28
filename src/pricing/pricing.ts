import BigNumber from "bignumber.js";

import { ARC, ByteCount } from "../types";
import { AR } from "../types/ar";
import { Winston } from "../types/winston";
import { ReadThroughBytesToWinstonOracle } from "./oracles/BytesToWinstonOracle";
import { ReadThroughFiatToArOracle } from "./oracles/arweaveToFiatOracle";

export interface PricingService {
  getARCForFiat: (fiat: string) => Promise<ARC>;
  getARCForBytes: (bytes: ByteCount) => Promise<ARC>;
}

export class TurboPricingService implements PricingService {
  private readonly BytesToWinstonOracle: ReadThroughBytesToWinstonOracle;
  private readonly arweaveToFiatOracle: ReadThroughFiatToArOracle;

  constructor({
    BytesToWinstonOracle,
    arweaveToFiatOracle,
  }: {
    BytesToWinstonOracle: ReadThroughBytesToWinstonOracle;
    arweaveToFiatOracle: ReadThroughFiatToArOracle;
  }) {
    this.BytesToWinstonOracle = BytesToWinstonOracle;
    this.arweaveToFiatOracle = arweaveToFiatOracle;
  }

  async getARCForFiat(fiat: string): Promise<Winston> {
    const ar = await this.arweaveToFiatOracle.getFiatPriceOfAR(fiat);
    return AR.from(BigNumber(ar)).toWinston();
  }

  async getARCForBytes(bytes: ByteCount): Promise<Winston> {
    const winston = await this.BytesToWinstonOracle.getWinstonForBytes(bytes);
    return new Winston(winston);
  }
}
