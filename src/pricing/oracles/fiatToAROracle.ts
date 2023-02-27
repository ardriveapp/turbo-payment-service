import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";

import { ReadThroughPromiseCache } from "../../cache/readThroughPromiseCache";
import logger from "../../logger";

export interface FiatToAROracle {
  getARForFiat: (fiat: string) => Promise<number>;
}

export class CoingeckoFiatToAROracle implements FiatToAROracle {
  private readonly axiosInstance: AxiosInstance;

  constructor(axiosInstance?: AxiosInstance) {
    this.axiosInstance = axiosInstance ?? axios;
  }

  async getARForFiat(fiat: string): Promise<number> {
    axiosRetry(this.axiosInstance, {
      retries: 8,
      retryDelay: axiosRetry.exponentialDelay,
    });

    try {
      const result = await this.axiosInstance.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=${fiat}`
      );

      if (result.data.arweave[fiat]) {
        const fiatPrice = result.data.arweave[fiat];
        return fiatPrice;
      } else {
        throw new Error(
          `coingecko returned bad response ${result.data.arweave[fiat]}`
        );
      }
    } catch (error) {
      logger.error(
        `Error getting AR price in ${fiat} from Coingecko API`,
        error
      );
      throw error;
    }
  }
}

export class ReadThroughFiatToArOracle {
  private readonly oracle: FiatToAROracle;
  private readonly readThroughPromiseCache: ReadThroughPromiseCache<
    string,
    number
  >;

  constructor(oracle: FiatToAROracle) {
    this.oracle = oracle;
    this.readThroughPromiseCache = new ReadThroughPromiseCache(10);
  }

  async getARForFiat(fiat: string): Promise<number> {
    //TODO Get from elasticache first
    const cachedValue = this.readThroughPromiseCache.get(
      fiat.toString(),
      this.oracle.getARForFiat(fiat)
    );
    return cachedValue;
  }
}
