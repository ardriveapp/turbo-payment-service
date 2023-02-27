import logger from "../logger";
import { PromiseCache } from "./promiseCache";

export class ReadThroughPromiseCache<K, V> {
  private readonly cache: PromiseCache<K, V>;

  constructor(cacheCapacity: number, cacheTTL?: number) {
    this.cache = new PromiseCache(cacheCapacity, cacheTTL);
  }

  get(key: K, readThroughFunction: Promise<V>): Promise<V> {
    const cachedValue = this.cache.get(key);
    if (cachedValue) {
      return cachedValue;
    }

    const valuePromise = readThroughFunction;
    valuePromise.catch((err) => {
      logger.error(`Error getting value for key ${key}`, err);
      this.cache.remove(key);
    });
    this.cache.put(key, valuePromise);
    return valuePromise;
  }

  //    Example readThroughFunction = () => {
  //       // NO NESTING!
  //       // try elasticcache
  //       if hit, return it
  //       else try fiatOracle

  //       return myFiatToAROracle.getFiatPerOneAR();
  //    }
}
