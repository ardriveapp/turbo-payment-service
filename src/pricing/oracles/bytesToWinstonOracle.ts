import { AxiosInstance } from "axios";
import BigNumber from "bignumber.js";

import {
  CreateAxiosInstanceParams,
  createAxiosInstance,
} from "../../axiosClient";
import { ReadThroughPromiseCache } from "../../cache/readThroughPromiseCache";
import { msPerMinute } from "../../constants";
import logger from "../../logger";
import { ByteCount } from "../../types/byte_count";
import { Winston } from "../../types/winston";

export interface BytesToWinstonOracle {
  getWinstonForBytes: (bytes: ByteCount) => Promise<Winston>;
}

export class ArweaveBytesToWinstonOracle implements BytesToWinstonOracle {
  private readonly axiosInstance: AxiosInstance;

  constructor(axiosInstanceParams?: CreateAxiosInstanceParams) {
    this.axiosInstance = createAxiosInstance(axiosInstanceParams ?? {});
  }

  async getWinstonForBytes(bytes: ByteCount): Promise<Winston> {
    try {
      const response = await this.axiosInstance.get(
        `https://arweave.net/price/${bytes.roundToChunkSize()}`
      );
      if (typeof response.data === "number") {
        return new Winston(BigNumber(response.data));
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
    ByteCount,
    Winston
  >;
  private getWinstonForBytesFromOracle = async (bytes: ByteCount) => {
    //TODO Get from elasticache first
    return this.oracle.getWinstonForBytes(bytes);
  };

  constructor({
    oracle,
    cacheParams,
  }: {
    oracle: BytesToWinstonOracle;
    cacheParams?: { cacheCapacity: number; cacheTTL: number };
  }) {
    this.oracle = oracle;
    this.readThroughPromiseCache = new ReadThroughPromiseCache({
      cacheParams: {
        cacheCapacity: cacheParams?.cacheCapacity ?? 100,
        cacheTTL: cacheParams?.cacheTTL ?? msPerMinute * 15,
      },
      readThroughFunction: this.getWinstonForBytesFromOracle,
    });
  }

  async getWinstonForBytes(bytes: ByteCount): Promise<Winston> {
    const cachedValue = this.readThroughPromiseCache.get(bytes);

    return cachedValue;
  }
}
