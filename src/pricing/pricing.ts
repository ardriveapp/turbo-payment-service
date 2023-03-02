import BigNumber from "bignumber.js";

import { ARC } from "../types";
import { AR } from "../types/ar";
import { ByteCount } from "../types/byte_count";
import { Winston } from "../types/winston";
import { ReadThroughArweaveToFiatOracle } from "./oracles/arweaveToFiatOracle";
import { ReadThroughBytesToWinstonOracle } from "./oracles/bytesToWinstonOracle";

export interface PricingService {
  getARCForFiat: (fiat: string, fiatQuantity: number) => Promise<ARC>;
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

  async getARCForFiat(fiat: string, fiatQuantity: number): Promise<Winston> {
    const fiatPrice = await this.arweaveToFiatOracle.getFiatPriceForOneAR(fiat);
    return AR.from(BigNumber(fiatQuantity / fiatPrice)).toWinston();
  }

  async getARCForBytes(bytes: ByteCount): Promise<Winston> {
    const winston = await this.BytesToWinstonOracle.getWinstonForBytes(bytes);
    return new Winston(winston);
  }
}
