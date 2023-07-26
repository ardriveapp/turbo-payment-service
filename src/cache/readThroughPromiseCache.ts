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
import logger from "../logger";
import { CacheParams, PromiseCache } from "./promiseCache";

interface ReadThroughPromiseCacheParams<K, V> {
  /**
   * @example
    readThroughFunction = () => {
        // try elastic cache
        if hit, return it
        else try fiatOracle
        return myArweaveToFiatOracle.getFiatPerOneAR();
     }
  */
  readThroughFunction: (key: K) => Promise<V>;
  cacheParams: CacheParams;
}

export class ReadThroughPromiseCache<K, V> {
  private readonly cache: PromiseCache<K, V>;
  private readonly readThroughFunction: (key: K) => Promise<V>;
  constructor({
    cacheParams,
    readThroughFunction,
  }: ReadThroughPromiseCacheParams<K, V>) {
    this.cache = new PromiseCache(cacheParams);
    this.readThroughFunction = readThroughFunction;
  }

  get(key: K): Promise<V> {
    const cachedValue = this.cache.get(key);
    if (cachedValue) {
      return cachedValue;
    }

    const valuePromise = this.readThroughFunction(key);

    valuePromise.catch(() => {
      logger.error(`Error getting value for key ${key}`);
      this.cache.remove(key);
    });

    void this.cache.put(key, valuePromise);

    return valuePromise;
  }
}
