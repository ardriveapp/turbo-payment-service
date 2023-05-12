import { createAxiosInstance } from "../../axiosClient";
import { CacheParams } from "../../cache/promiseCache";
import { ReadThroughPromiseCache } from "../../cache/readThroughPromiseCache";
import logger from "../../logger";
import { supportedPaymentCurrencyTypes } from "../../types/supportedCurrencies";

interface CoinGeckoResponse {
  [currencyType: string]: number;
}

/** Type guard thats checks that each supported payment currency type exists on response */
function isCoinGeckoResponse(response: unknown): response is CoinGeckoResponse {
  for (const curr of supportedPaymentCurrencyTypes) {
    if (typeof (response as CoinGeckoResponse)[curr] !== "number") {
      return false;
    }
  }
  return true;
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
      const { data } = await this.axiosInstance.get(url);

      const coinGeckoResponse = data.arweave;

      if (!isCoinGeckoResponse(coinGeckoResponse)) {
        const errorMsg = "Unexpected response shape from coin gecko!";
        logger.error(errorMsg, {
          responseData: data,
          url,
        });
        throw Error(errorMsg);
      }

      return coinGeckoResponse;
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
