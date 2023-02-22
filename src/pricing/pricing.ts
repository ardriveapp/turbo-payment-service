import { PromiseCache } from "../cache/promiseCache";
import { oneMinute } from "../constants";
import { BytesToAROracle } from "./oracles/bytesToAROracle";
import { FiatToAROracle } from "./oracles/fiatToAROracle";

export interface PricingService {
  getARCForFiat: (fiat: string) => Promise<number>;
  getARCForBytes: (bytes: number) => Promise<number>;
}

export class TurboPricingService implements PricingService {
  private readonly bytesToAROracle: BytesToAROracle;
  private readonly fiatToAROracle: FiatToAROracle;

  private readonly arcForFiatRequestCache: PromiseCache<string, number>;
  private readonly arcForBytesRequestCache: PromiseCache<number, number>;

  constructor(
    bytesToAROracle: BytesToAROracle,
    fiatToAROracle: FiatToAROracle
  ) {
    this.bytesToAROracle = bytesToAROracle;
    this.fiatToAROracle = fiatToAROracle;

    this.arcForFiatRequestCache = new PromiseCache(oneMinute);
    this.arcForBytesRequestCache = new PromiseCache(oneMinute);
  }

  async getARCForFiat(fiat: string): Promise<number> {
    const cached = this.arcForFiatRequestCache.get(fiat);
    if (cached) {
      return cached;
    }

    return this.arcForFiatRequestCache.put(
      fiat,
      this.fiatToAROracle.getARForFiat(fiat)
    );
  }

  async getARCForBytes(bytes: number): Promise<number> {
    const cached = this.arcForBytesRequestCache.get(bytes);
    if (cached) {
      return cached;
    }

    return this.arcForBytesRequestCache.put(
      bytes,
      this.bytesToAROracle.getARForBytes(bytes)
    );
  }
}
