import { AxiosInstance } from "axios";
import BigNumber from "bignumber.js";

import {
  CreateAxiosInstanceParams,
  createAxiosInstance,
} from "../../axiosClient";
import { CacheParams } from "../../cache/promiseCache";
import { ReadThroughPromiseCache } from "../../cache/readThroughPromiseCache";
import { msPerMinute } from "../../constants";
import logger from "../../logger";
import { ByteCount, Winston } from "../../types/types";

export interface BytesToWinstonOracle {
  getWinstonForBytes: (bytes: ByteCount) => Promise<Winston>;
}

export class ArweaveBytesToWinstonOracle implements BytesToWinstonOracle {
  private readonly axiosInstance: AxiosInstance;

  constructor(axiosInstanceParams?: CreateAxiosInstanceParams) {
    this.axiosInstance = createAxiosInstance(axiosInstanceParams ?? {});
  }

  async getWinstonForBytes(bytes: ByteCount): Promise<Winston> {
    const url = `https://arweave.net/price/${bytes}`;
    try {
      const response = await this.axiosInstance.get(url);
      if (typeof response.data === "number") {
        return new Winston(BigNumber(response.data));
      } else {
        throw new Error(
          `arweave.net returned bad response ${response.data} URL: ${url}`
        );
      }
    } catch (error) {
      logger.error(`Error getting AR price URL: ${url}`, error);
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
    oracle?: BytesToWinstonOracle;
    cacheParams?: CacheParams;
  }) {
    this.oracle = oracle ?? new ArweaveBytesToWinstonOracle();
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
