import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";

import { ReadThroughPromiseCache } from "../../cache/readThroughPromiseCache";
import logger from "../../logger";

export interface BytesToAROracle {
  getARForBytes: (bytes: number) => Promise<number>;
}

export class ArweaveBytesToAROracle implements BytesToAROracle {
  private readonly axiosInstance: AxiosInstance;

  constructor(axiosInstance?: AxiosInstance) {
    this.axiosInstance = axiosInstance ?? axios.create();
  }
  roundToChunkSize = (bytes: number) => {
    const chunkSize = 256 * 1024;
    return Math.ceil(bytes / chunkSize) * chunkSize;
  };

  async getARForBytes(bytes: number): Promise<number> {
    bytes = this.roundToChunkSize(bytes);

    axiosRetry(this.axiosInstance, {
      retries: 8,
      retryDelay: axiosRetry.exponentialDelay,
    });

    try {
      const response = await this.axiosInstance.get(
        `https://arweave.net/price/${bytes}`
      );
      if (typeof response.data === "number") {
        return response.data;
      } else {
        throw new Error(`arweave.net returned bad response ${response.data}`);
      }
    } catch (error) {
      logger.error(`Error getting AR price`, error);
      throw error;
    }
  }
}

export class ReadThroughBytesToArOracle {
  private readonly oracle: BytesToAROracle;
  private readonly readThroughPromiseCache: ReadThroughPromiseCache<
    string,
    number
  >;

  constructor(oracle: BytesToAROracle) {
    this.oracle = oracle;
    this.readThroughPromiseCache = new ReadThroughPromiseCache(10);
  }

  async getARForBytes(bytes: number): Promise<number> {
    //TODO Get from elasticache first
    const cachedValue = this.readThroughPromiseCache.get(
      bytes.toString(),
      this.oracle.getARForBytes(bytes)
    );
    return cachedValue;
  }
}
