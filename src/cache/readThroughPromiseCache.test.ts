import { expect } from "chai";
import { describe, it } from "mocha";

import { ReadThroughPromiseCache } from "./readThroughPromiseCache";

describe("ReadThroughPromiseCache Class", () => {
  it("should be able to cache and retrieve new entries", async () => {
    const cache = new ReadThroughPromiseCache<string, string>({
      cacheCapacity: 10,
      readThroughFunction: () => Promise.resolve("one"),
    });
    cache.get("1");

    expect(await cache.get("1")).to.equal("one");
  });

  it("should throw error if readthrough function throws", async () => {
    const cache = new ReadThroughPromiseCache<string, string>({
      cacheCapacity: 10,
      readThroughFunction: () => {
        throw new Error("test error");
      },
    });
    try {
      cache.get("1");
      expect.fail("The function should throw an error");
    } catch (error) {
      expect(error).to.exist;
    }
  });

  it("should purge all entries after ttl expires", async () => {
    // Test function to make sure we return a different value after the first call
    // Since function is passed in the constructor

    let testTracker = 0;

    const testFunction = async () => {
      if (testTracker < 1) {
        testTracker++;
        return "one";
      } else {
        return "two";
      }
    };

    const cache = new ReadThroughPromiseCache<string, string>({
      cacheCapacity: 10,
      readThroughFunction: testFunction,
      cacheTTL: 5,
    });

    expect(await cache.get("1")).to.equal("one");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(await cache.get("1")).to.equal("two");
  });

  it("preserves most requested entries when over capacity", async () => {
    // Test function to make sure we return a different value after the first call
    // Since function is passed in the constructor
    let testTracker = 0;

    const testFunction = async () => {
      if (testTracker < 1) {
        testTracker++;
        return "one";
      } else {
        return "two";
      }
    };

    const cache = new ReadThroughPromiseCache<string, string>({
      cacheCapacity: 3,
      readThroughFunction: testFunction,
      cacheTTL: 5,
    });

    expect(await cache.get("1")).to.equal("one");
    expect(await cache.get("1")).to.equal("one");
    expect(await cache.get("2")).to.equal("two");
    expect(await cache.get("1")).to.equal("one");
  });
});
