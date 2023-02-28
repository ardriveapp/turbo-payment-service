import BigNumber from "bignumber.js";

import { ARC, ByteCount } from "../types";
import { AR } from "../types/ar";
import { Winston } from "../types/winston";
import { ReadThroughArweaveToFiatOracle } from "./oracles/arweaveToFiatOracle";
import { ReadThroughBytesToWinstonOracle } from "./oracles/bytesToWinstonOracle";

export interface PricingService {
  getARCForFiat: (fiat: string) => Promise<ARC>;
  getARCForBytes: (bytes: ByteCount) => Promise<ARC>;
}

export class TurboPricingService implements PricingService {
  private readonly BytesToWinstonOracle: ReadThroughBytesToWinstonOracle;
  private readonly arweaveToFiatOracle: ReadThroughArweaveToFiatOracle;

  constructor({
    BytesToWinstonOracle,
    arweaveToFiatOracle,
  }: {
    BytesToWinstonOracle: ReadThroughBytesToWinstonOracle;
    arweaveToFiatOracle: ReadThroughArweaveToFiatOracle;
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
