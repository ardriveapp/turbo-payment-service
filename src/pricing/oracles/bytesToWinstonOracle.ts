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
import { AxiosInstance } from "axios";
import BigNumber from "bignumber.js";

import {
  CreateAxiosInstanceParams,
  createAxiosInstance,
} from "../../axiosClient";
import { msPerMinute } from "../../constants";
import globalLogger from "../../logger";
import { ByteCount, Winston } from "../../types";

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

    globalLogger.debug(`Getting AR price URL: ${url}`);
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
      globalLogger.error(`Error getting AR price URL: ${url}`, error);
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
