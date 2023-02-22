import axios from "axios";
import axiosRetry from "axios-retry";

import { OracleCache } from "../../cache/oracleCache";
import logger from "../../logger";

export interface BytesToAROracle {
  getARForBytes: (bytes: number) => Promise<number>;
}

export class ArweaveBytesToAROracle implements BytesToAROracle {
  private readonly cache: OracleCache<number, number>;

  constructor() {
    this.cache = new OracleCache(1000);
  }

  async getARForBytes(bytes: number): Promise<number> {
    const roundToChunkSize = (bytes: number) => {
      const chunkSize = 256 * 1024;
      return Math.ceil(bytes / chunkSize) * chunkSize;
    };

    bytes = roundToChunkSize(bytes);

    const cached = this.cache.get(bytes);
    if (cached) {
      return cached;
    }

    axiosRetry(axios, {
      retries: 8,
      retryDelay: axiosRetry.exponentialDelay,
    });

    const result: number = await axios
      .get(`https://arweave.net/price/${bytes}`)
      .then((response) => {
        if (response.status !== 200) {
          throw new Error(
            `Coingecko API returned status code ${response.status}`
          );
        }
        return response.data;
      })
      .catch((error) => {
        logger.error(`Error getting AR price`, error);
        throw error;
      });
    return this.cache.put(bytes, result);
  }
}
