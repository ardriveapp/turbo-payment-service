import axios from "axios";
import axiosRetry from "axios-retry";

import { OracleCache } from "../../cache/oracleCache";
import logger from "../../logger";

export interface FiatToAROracle {
  getARForFiat: (fiat: string) => Promise<number>;
}

export class CoingeckoFiatToAROracle implements FiatToAROracle {
  private readonly cache: OracleCache<string, number>;

  constructor() {
    this.cache = new OracleCache(1000);
  }

  async getARForFiat(fiat: string): Promise<number> {
    const cached = this.cache.get(fiat);
    if (cached) {
      return cached;
    }

    axiosRetry(axios, {
      retries: 8,
      retryDelay: axiosRetry.exponentialDelay,
    });

    const result: number = await axios
      .get(
        `https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=${fiat}`
      )
      .then((response) => {
        if (response.status !== 200) {
          throw new Error(
            `Coingecko API returned status code ${response.status}`
          );
        }
        return response.data.arweave[fiat];
      })
      .catch((error) => {
        logger.error(
          `Error getting AR price in ${fiat} from Coingecko API`,
          error
        );
        throw error;
      });

    return this.cache.put(fiat, result);
  }
}
