import { AxiosInstance } from "axios";

import {
  CreateAxiosInstanceParams,
  createAxiosInstance,
} from "../../axiosClient";
import { CacheParams } from "../../cache/promiseCache";
import { ReadThroughPromiseCache } from "../../cache/readThroughPromiseCache";
import logger from "../../logger";

export interface ArweaveToFiatOracle {
  getFiatPriceForOneAR: (fiat: string) => Promise<number>;
}

export class CoingeckoArweaveToFiatOracle implements ArweaveToFiatOracle {
  private readonly axiosInstance: AxiosInstance;

  constructor(axiosInstanceParams?: CreateAxiosInstanceParams) {
    this.axiosInstance = createAxiosInstance(axiosInstanceParams ?? {});
  }

  async getFiatPriceForOneAR(fiat: string): Promise<number> {
    fiat = fiat.toLowerCase();

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=${fiat}`;
    logger.info(`Getting AR price in ${fiat} from Coingecko API URL: ${url}`);

    try {
      const result = await this.axiosInstance.get(url);
      if (result.data.arweave[fiat]) {
        const fiatPriceOfOneAR = result.data.arweave[fiat];
        return Number(fiatPriceOfOneAR);
      } else {
        throw new Error(result.data);
      }
    } catch (error) {
      logger.error(
        `Error getting AR price in ${fiat} from Coingecko API URL: ${url}`,
        error
      );
      throw error;
    }
  }
}

export class ReadThroughArweaveToFiatOracle {
  private readonly oracle: ArweaveToFiatOracle;
  private readonly readThroughPromiseCache: ReadThroughPromiseCache<
    string,
    number
  >;

  private getFiatPriceForOneARFromOracle = async (fiat: string) => {
    //TODO Get from elasticache first
    return this.oracle.getFiatPriceForOneAR(fiat);
  };

  constructor({
    oracle,
    cacheParams,
  }: {
    oracle?: ArweaveToFiatOracle;
    cacheParams?: CacheParams;
  }) {
    this.oracle = oracle ?? new CoingeckoArweaveToFiatOracle();
    this.readThroughPromiseCache = new ReadThroughPromiseCache({
      cacheParams: cacheParams ?? { cacheCapacity: 10 },
      readThroughFunction: this.getFiatPriceForOneARFromOracle,
    });
  }

  async getFiatPriceForOneAR(fiat: string): Promise<number> {
    const cachedValue = this.readThroughPromiseCache.get(fiat);
    return cachedValue;
  }
}
