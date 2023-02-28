import BigNumber from "bignumber.js";

import { AxiosClient } from "../../axiosClient";
import { ReadThroughPromiseCache } from "../../cache/readThroughPromiseCache";
import logger from "../../logger";

export interface BytesToWinstonOracle {
  getWinstonForBytes: (bytes: number) => Promise<BigNumber>;
}

export class ArweaveBytesToWinstonOracle implements BytesToWinstonOracle {
  private readonly axiosClient: AxiosClient;

  constructor(axiosClient?: AxiosClient) {
    this.axiosClient = axiosClient ?? new AxiosClient({});
  }
  roundToChunkSize = (bytes: number) => {
    const chunkSize = 256 * 1024;
    return Math.ceil(bytes / chunkSize) * chunkSize;
  };

  async getWinstonForBytes(bytes: number): Promise<BigNumber> {
    bytes = this.roundToChunkSize(bytes);

    try {
      const response = await this.axiosClient.get(
        `https://arweave.net/price/${bytes}`
      );
      if (typeof response.data === "number") {
        return BigNumber(response.data);
      } else {
        throw new Error(`arweave.net returned bad response ${response.data}`);
      }
    } catch (error) {
      logger.error(`Error getting AR price`, error);
      throw error;
    }
  }
}

export class ReadThroughBytesToWinstonOracle {
  private readonly oracle: BytesToWinstonOracle;
  private readonly readThroughPromiseCache: ReadThroughPromiseCache<
    number,
    BigNumber
  >;
  private getWinstonForBytesFromOracle = async (bytes: number) => {
    //TODO Get from elasticache first
    return this.oracle.getWinstonForBytes(bytes);
  };

  constructor({ oracle }: { oracle: BytesToWinstonOracle }) {
    this.oracle = oracle;
    this.readThroughPromiseCache = new ReadThroughPromiseCache({
      cacheCapacity: 10,
      readThroughFunction: this.getWinstonForBytesFromOracle,
    });
  }

  async getWinstonForBytes(bytes: number): Promise<BigNumber> {
    //construct a function that returns a promise

    const cachedValue = this.readThroughPromiseCache.get(bytes);

    return cachedValue;
  }
}
