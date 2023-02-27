import BigNumber from "bignumber.js";

import { ReadThroughBytesToArOracle } from "./oracles/bytesToAROracle";
import { ReadThroughFiatToArOracle } from "./oracles/fiatToAROracle";

type ARC = BigNumber;

export interface PricingService {
  getARCForFiat: (fiat: string) => Promise<ARC>;
  getARCForBytes: (bytes: number) => Promise<ARC>;
}

export class TurboPricingService implements PricingService {
  private readonly bytesToAROracle: ReadThroughBytesToArOracle;
  private readonly fiatToAROracle: ReadThroughFiatToArOracle;

  constructor(
    bytesToAROracle: ReadThroughBytesToArOracle,
    fiatToAROracle: ReadThroughFiatToArOracle
  ) {
    this.bytesToAROracle = bytesToAROracle;
    this.fiatToAROracle = fiatToAROracle;
  }

  async getARCForFiat(fiat: string): Promise<ARC> {
    const ar = await this.fiatToAROracle.getARForFiat(fiat);
    return new BigNumber(ar);
  }

  async getARCForBytes(bytes: number): Promise<ARC> {
    const ar = await this.bytesToAROracle.getARForBytes(bytes);
    return new BigNumber(ar);
  }
}
