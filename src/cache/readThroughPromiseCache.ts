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
