import { Cache, EphemeralCache } from "@alexsasharegan/simple-cache";

import { msPerMinute } from "../constants";

export class PromiseCache<K, V> {
  private cache: Cache<string, Promise<V>>;

  constructor(capacity: number, duration = msPerMinute * 1) {
    this.cache = EphemeralCache<string, Promise<V>>(capacity, duration);
  }

  cacheKeyString(key: K): string {
    // Note: This implementation may not sufficiently differentiate keys
    // for certain object types depending on their toJSON implementation
    return typeof key === "string" ? key : JSON.stringify(key);
  }

  put(key: K, value: Promise<V>): Promise<V> {
    this.cache.write(this.cacheKeyString(key), value);
    return value;
  }

  get(key: K): Promise<V> | undefined {
    return this.cache.read(this.cacheKeyString(key));
  }

  remove(key: K): void {
    this.cache.remove(this.cacheKeyString(key));
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size();
  }
}
