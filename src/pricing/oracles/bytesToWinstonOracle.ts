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

export interface BytesToWinstonOracle {
  getWinstonForBytes: (bytes: ByteCount) => Promise<BigNumber>;
}

export class ArweaveBytesToWinstonOracle implements BytesToWinstonOracle {
  private readonly axiosInstanceParams: CreateAxiosInstanceParams;
  private readonly axiosInstance: AxiosInstance;

  constructor(axiosInstanceParams?: CreateAxiosInstanceParams) {
    this.axiosInstanceParams = axiosInstanceParams ?? {};
    this.axiosInstance = createAxiosInstance(this.axiosInstanceParams);
  }

  async getWinstonForBytes(bytes: ByteCount): Promise<BigNumber> {
    const url = `https://arweave.net/price/${bytes}`;
    try {
      const response = await this.axiosInstance.get(url);
      if (typeof response.data === "number") {
        return BigNumber(response.data);
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
    BigNumber
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
      cacheCapacity: cacheParams?.cacheCapacity ?? 100,
      cacheTTL: cacheParams?.cacheTTL ?? msPerMinute * 15,
      readThroughFunction: this.getWinstonForBytesFromOracle,
    });
  }

  async getWinstonForBytes(bytes: ByteCount): Promise<BigNumber> {
    const chunkBytes = bytes.roundToChunkSize();
    const cachedValue = this.readThroughPromiseCache.get(chunkBytes);

    return cachedValue;
  }
}
