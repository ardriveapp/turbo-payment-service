import logger from "../logger";
import { CacheParams, PromiseCache } from "./promiseCache";

interface ReadThroughPromiseCacheParams<K, V> {
  /**
   * @example
    readThroughFunction = () => {
        // try elasticcache
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

    valuePromise.catch((err) => {
      logger.error(`Error getting value for key ${key}`, err);
      this.cache.remove(key);
      throw err;
    });

    void this.cache.put(key, valuePromise);

    return valuePromise;
  }
}
