import BigNumber from "bignumber.js";

import { AR } from "../types/ar";
import { Winston } from "../types/winston";
import { ReadThroughBytesToArOracle } from "./oracles/bytesToAROracle";
import { ReadThroughFiatToArOracle } from "./oracles/fiatToAROracle";

type ARC = Winston;

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
    return AR.from(BigNumber(ar)).toARC();
  }

  async getARCForBytes(bytes: number): Promise<ARC> {
    const ar = await this.bytesToAROracle.getARForBytes(bytes);
    return AR.from(BigNumber(ar)).toARC();
  }
}
