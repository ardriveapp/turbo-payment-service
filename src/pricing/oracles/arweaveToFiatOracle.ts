import { AxiosClient } from "../../axiosClient";
import { ReadThroughPromiseCache } from "../../cache/readThroughPromiseCache";
import logger from "../../logger";

export interface ArweaveToFiatOracle {
  getFiatPriceForOneAR: (fiat: string) => Promise<number>;
}

export class CoingeckoArweaveToFiatOracle implements ArweaveToFiatOracle {
  private readonly axiosClient: AxiosClient;

  constructor(axiosClient?: AxiosClient) {
    this.axiosClient = axiosClient ?? new AxiosClient({});
  }

  async getFiatPriceForOneAR(fiat: string): Promise<number> {
    try {
      const result = await this.axiosClient.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=${fiat}`
      );

      if (result.data.arweave[fiat]) {
        const fiatPriceOfOneAR = result.data.arweave[fiat];
        return fiatPriceOfOneAR;
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

  private getFiatPriceForOneARFromOracle = async (fiat: string) => {
    //TODO Get from elasticache first
    return this.oracle.getFiatPriceForOneAR(fiat);
  };

  constructor({ oracle }: { oracle: ArweaveToFiatOracle }) {
    this.oracle = oracle;
    this.readThroughPromiseCache = new ReadThroughPromiseCache({
      cacheCapacity: 10,
      readThroughFunction: this.getFiatPriceForOneARFromOracle,
    });
  }

  async getFiatPriceForOneAR(fiat: string): Promise<number> {
    const cachedValue = this.readThroughPromiseCache.get(fiat.toString());
    return cachedValue;
  }
}
