/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import {
  CacheParams,
  ReadThroughPromiseCache,
} from "@ardrive/ardrive-promise-cache";

import { createAxiosInstance } from "../../axiosClient";
import logger from "../../logger";
import { supportedPaymentCurrencyTypes } from "../../types/supportedCurrencies";

interface CoinGeckoResponse {
  [currencyType: string]: number;
}

const coinGeckoUrl =
  process.env.COINGECKO_API_URL ?? "https://api.coingecko.com/api/v3/";

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

    const url = `${coinGeckoUrl}simple/price?ids=arweave&vs_currencies=${currencyTypesString}`;
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

const oneMinuteMs = 60 * 1000;

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
      cacheParams: cacheParams ?? {
        cacheCapacity: 10,
        cacheTTL: oneMinuteMs,
      },
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
