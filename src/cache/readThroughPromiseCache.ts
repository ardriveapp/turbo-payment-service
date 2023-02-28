import logger from "../logger";
import { PromiseCache } from "./promiseCache";

interface ReadThroughPromiseCacheParams<K, V> {
  cacheCapacity: number;
  readThroughFunction: (key: K) => Promise<V>;
  cacheTTL?: number;
}

export class ReadThroughPromiseCache<K, V> {
  private readonly cache: PromiseCache<K, V>;
  private readonly readThroughFunction: (key: K) => Promise<V>;
  constructor({
    cacheCapacity,
    cacheTTL,
    readThroughFunction,
  }: ReadThroughPromiseCacheParams<K, V>) {
    this.cache = new PromiseCache(cacheCapacity, cacheTTL);
    this.readThroughFunction = readThroughFunction;
  }

  /**
   * @example
    readThroughFunction = () => {
        // try elasticcache
        if hit, return it
        else try fiatOracle
        return myArweaveToFiatOracle.getFiatPerOneAR();
     }
  */

  get(key: K): Promise<V> {
    const cachedValue = this.cache.get(key);
    if (cachedValue) {
      return cachedValue;
    }

    const valuePromise = this.readThroughFunction(key);

    valuePromise.catch((err) => {
      logger.error(`Error getting value for key ${key}`, err);
      this.cache.remove(key);
      throw err;
    });

    this.cache.put(key, valuePromise);
    return valuePromise;
  }
}
