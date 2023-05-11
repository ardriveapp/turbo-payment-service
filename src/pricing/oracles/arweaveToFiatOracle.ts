import { createAxiosInstance } from "../../axiosClient";
import { CacheParams } from "../../cache/promiseCache";
import { ReadThroughPromiseCache } from "../../cache/readThroughPromiseCache";
import logger from "../../logger";
import { supportedPaymentCurrencyTypes } from "../../types/supportedCurrencies";

interface CoinGeckoResponse {
  [currencyType: string]: number;
}

export interface ArweaveToFiatOracle {
  getFiatPricesForOneAR: () => Promise<CoinGeckoResponse>;
}

export class CoingeckoArweaveToFiatOracle implements ArweaveToFiatOracle {
  constructor(private readonly axiosInstance = createAxiosInstance({})) {}

  public async getFiatPricesForOneAR(): Promise<CoinGeckoResponse> {
    const currencyTypesString = supportedPaymentCurrencyTypes
      .toString()
      .replace("'", "");

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=${currencyTypesString}`;
    try {
      logger.info(`Getting AR prices from Coingecko`, { url });
      const result = await this.axiosInstance.get(url);

      // todo: typecheck this 😅
      return result.data.arweave;
    } catch (error) {
      logger.error(`Error getting AR price in from Coingecko`, { url });
      logger.error(error);
      throw error;
    }
  }
}

export class ReadThroughArweaveToFiatOracle {
  private readonly oracle: ArweaveToFiatOracle;
  private readonly readThroughPromiseCache: ReadThroughPromiseCache<
    "arweave",
    CoinGeckoResponse
  >;

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
      readThroughFunction: () =>
        // TODO: Get from service level cache before oracle (elasticache)
        this.oracle.getFiatPricesForOneAR(),
    });
  }

  async getFiatPriceForOneAR(fiat: string): Promise<number> {
    const cachedValue = await this.readThroughPromiseCache.get("arweave");
    return cachedValue[fiat];
  }
}
