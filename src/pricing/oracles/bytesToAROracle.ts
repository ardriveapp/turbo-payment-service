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

    try {
      const response = await this.axiosInstance.get(
        `https://arweave.net/price/${bytes}`
      );
      if (typeof response.data === "number") {
        return this.cache.put(bytes, response.data);
      } else {
        throw new Error(`arweave.net returned bad response ${response.data}`);
      }
    } catch (error) {
      logger.error(`Error getting AR price`, error);
      throw error;
    }
  }
}
