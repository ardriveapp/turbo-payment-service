import { expect } from "chai";
import { describe, it } from "mocha";

import { ReadThroughPromiseCache } from "./readThroughPromiseCache";

describe("ReadThroughPromiseCache Class", () => {
  it("should be able to cache and retrieve new entries", async () => {
    const cache = new ReadThroughPromiseCache<string, string>(1);
    cache.get("1", () => Promise.resolve("one"));

    expect(await cache.get("1", () => Promise.resolve("two"))).to.equal("one");
  });

  it("should purge all entries after ttl expires", async () => {
    const cache = new ReadThroughPromiseCache<string, string>(1, 5);
    cache.get("1", () => Promise.resolve("one"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(await cache.get("1", () => Promise.resolve("two"))).to.not.equal(
      "one"
    );
  });
});
