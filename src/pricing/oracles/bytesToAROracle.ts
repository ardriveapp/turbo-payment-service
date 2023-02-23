import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";

import { OracleCache } from "../../cache/oracleCache";
import logger from "../../logger";

export interface BytesToAROracle {
  getARForBytes: (bytes: number) => Promise<number>;
}

export class ArweaveBytesToAROracle implements BytesToAROracle {
  private readonly cache: OracleCache<number, number>;
  private readonly axiosInstance: AxiosInstance;

  constructor(axiosInstance?: AxiosInstance) {
    this.cache = new OracleCache(1000);
    this.axiosInstance = axiosInstance ?? axios.create();
  }
  roundToChunkSize = (bytes: number) => {
    const chunkSize = 256 * 1024;
    return Math.ceil(bytes / chunkSize) * chunkSize;
  };

  async getARForBytes(bytes: number): Promise<number> {
    bytes = this.roundToChunkSize(bytes);

    const cached = this.cache.get(bytes);
    if (cached) {
      return cached;
    }

    axiosRetry(this.axiosInstance, {
      retries: 8,
      retryDelay: axiosRetry.exponentialDelay,
    });

    const result: number = await this.axiosInstance
      .get(`https://arweave.net/price/${bytes}`)
      .then((response) => {
        if (response.status !== 200) {
          throw new Error(
            `arweave.net returned status code ${response.status}`
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
