/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
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
import { TokenType, supportedPaymentTokens } from "../../types";
import {
  SupportedFiatPaymentCurrencyType,
  supportedFiatPaymentCurrencyTypes,
} from "../../types/supportedCurrencies";

const coinGeckoTokenNames = [
  "arweave",
  "ethereum",
  "solana",
  "kyve-network",
  "matic-network",
  "l2-standard-bridged-weth-base",
  "ar-io-network",
] as const;

type CoinGeckoTokenName = (typeof coinGeckoTokenNames)[number];

export const tokenNameToCoinGeckoTokenName: Record<
  TokenType,
  CoinGeckoTokenName
> = {
  arweave: "arweave",
  ethereum: "ethereum",
  solana: "solana",
  ed25519: "solana",
  pol: "matic-network",
  kyve: "kyve-network",
  matic: "matic-network",
  "base-eth": "l2-standard-bridged-weth-base",
  ario: "ar-io-network",
};

type CoinGeckoResponse = Record<
  CoinGeckoTokenName,
  Record<SupportedFiatPaymentCurrencyType, number>
>;

const coinGeckoUrl =
  process.env.COINGECKO_API_URL ?? "https://api.coingecko.com/api/v3/";

/** Type guard thats checks that each supported payment currency type exists on response */
function isCoinGeckoResponse(response: unknown): response is CoinGeckoResponse {
  for (const curr of supportedFiatPaymentCurrencyTypes) {
    if (typeof (response as CoinGeckoResponse).arweave[curr] !== "number") {
      return false;
    }
  }
  return true;
}

export interface TokenToFiatOracle {
  getFiatPricesForOneToken: () => Promise<CoinGeckoResponse>;
}

export class CoingeckoTokenToFiatOracle implements TokenToFiatOracle {
  constructor(private readonly axiosInstance = createAxiosInstance({})) {}

  public async getFiatPricesForOneToken(): Promise<CoinGeckoResponse> {
    const currencyTypesString = supportedFiatPaymentCurrencyTypes
      .toString()
      .replace("'", "");

    const tokenTypesString = supportedPaymentTokens
      .map((t) => tokenNameToCoinGeckoTokenName[t])
      .toString()
      .replace("'", "");

    const url = `${coinGeckoUrl}simple/price?ids=${tokenTypesString}&vs_currencies=${currencyTypesString}`;
    try {
      logger.debug(`Getting AR prices from Coingecko`, { url });
      const { data } = await this.axiosInstance.get<CoinGeckoResponse>(url);

      const coinGeckoResponse = data;

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

export class ReadThroughTokenToFiatOracle {
  private readonly oracle: TokenToFiatOracle;
  private readonly readThroughPromiseCache: ReadThroughPromiseCache<
    "arweave",
    CoinGeckoResponse
  >;

  constructor({
    oracle,
    cacheParams,
  }: {
    oracle?: TokenToFiatOracle;
    cacheParams?: CacheParams;
  }) {
    this.oracle = oracle ?? new CoingeckoTokenToFiatOracle();
    this.readThroughPromiseCache = new ReadThroughPromiseCache({
      cacheParams: cacheParams ?? {
        cacheCapacity: 10,
        cacheTTL: oneMinuteMs,
      },
      readThroughFunction: () =>
        // TODO: Get from service level cache before oracle (elasticache)
        this.oracle.getFiatPricesForOneToken(),
    });
  }

  async getFiatPriceForOneAR(fiat: string): Promise<number> {
    const cachedValue = await this.readThroughPromiseCache.get("arweave");
    return cachedValue.arweave[fiat as SupportedFiatPaymentCurrencyType];
  }

  async getPriceRatioForToken(token: TokenType): Promise<number> {
    const cachedValue = await this.readThroughPromiseCache.get("arweave");
    const arweaveUsdPrice = cachedValue.arweave.usd;

    const coinGeckoToken = tokenNameToCoinGeckoTokenName[token];
    const tokenUsdPrice = cachedValue[coinGeckoToken].usd;

    return tokenUsdPrice / arweaveUsdPrice;
  }

  async getFiatPriceForOneToken(
    token: TokenType,
    fiat: string
  ): Promise<number> {
    const cachedValue = await this.readThroughPromiseCache.get("arweave");
    const coinGeckoToken = tokenNameToCoinGeckoTokenName[token];
    return cachedValue[coinGeckoToken][
      fiat as SupportedFiatPaymentCurrencyType
    ];
  }

  async getUsdPriceForOneToken(token: TokenType): Promise<number> {
    return this.getFiatPriceForOneToken(token, "usd");
  }
}
