import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";

import { OracleCache } from "../../cache/oracleCache";
import logger from "../../logger";

export interface FiatToAROracle {
  getARForFiat: (fiat: string) => Promise<number>;
}

export class CoingeckoFiatToAROracle implements FiatToAROracle {
  private readonly cache: OracleCache<string, number>;
  private readonly axiosInstance: AxiosInstance;

  constructor(axiosInstance?: AxiosInstance) {
    this.cache = new OracleCache(1000);
    this.axiosInstance = axiosInstance ?? axios;
  }

  async getARForFiat(fiat: string): Promise<number> {
    const cached = this.cache.get(fiat);
    if (cached) {
      return cached;
    }

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
        return this.cache.put(fiat, fiatPrice);
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
