import { AxiosClient } from "../../axiosClient";
import { ReadThroughPromiseCache } from "../../cache/readThroughPromiseCache";
import logger from "../../logger";

export interface ArweaveToFiatOracle {
  getFiatPriceOfAR: (fiat: string) => Promise<number>;
}

export class CoingeckoArweaveToFiatOracle implements ArweaveToFiatOracle {
  private readonly axiosClient: AxiosClient;

  constructor(axiosClient?: AxiosClient) {
    this.axiosClient = axiosClient ?? new AxiosClient({});
  }

  async getFiatPriceOfAR(fiat: string): Promise<number> {
    try {
      const result = await this.axiosClient.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=${fiat}`
      );

      if (result.data.arweave[fiat]) {
        const fiatPrice = result.data.arweave[fiat];
        return fiatPrice;
      } else {
        throw new Error(
          `coingecko returned bad response ${result.data.arweave[fiat]}`
        );
      }
    } catch (error) {
      logger.error(
        `Error getting AR price in ${fiat} from Coingecko API`,
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

  private getFiatPriceOfARFromOracle = async (fiat: string) => {
    //TODO Get from elasticache first
    return this.oracle.getFiatPriceOfAR(fiat);
  };

  constructor({ oracle }: { oracle: ArweaveToFiatOracle }) {
    this.oracle = oracle;
    this.readThroughPromiseCache = new ReadThroughPromiseCache({
      cacheCapacity: 10,
      readThroughFunction: this.getFiatPriceOfARFromOracle,
    });
  }

  async getFiatPriceOfAR(fiat: string): Promise<number> {
    const cachedValue = this.readThroughPromiseCache.get(fiat.toString());
    return cachedValue;
  }
}
