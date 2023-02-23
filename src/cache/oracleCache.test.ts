import { expect } from "chai";

import { OracleCache } from "./oracleCache";

describe("OracleCache class", () => {
  it("constructor takes a capacity that is not exceeded by excessive puts", async () => {
    const cache = new OracleCache<string, string>(1);
    cache.put("1", "one");
    cache.put("2", "two");
    expect(cache.get("1")).to.be.undefined;
    expect(cache.get("2")).to.not.be.undefined;
    expect(cache.get("2")).to.equal("two");
    expect(cache.size()).to.equal(1);
  });

  it("preserves most requested entries when over capacity", async () => {
    const cache = new OracleCache<string, string>(3);
    cache.put("1", "one");
    cache.put("2", "two");
    cache.put("3", "three");
    cache.get("1");
    cache.get("3");
    cache.put("4", "four");
    expect(cache.get("1")).to.not.be.undefined;
    expect(cache.get("2")).to.be.undefined;
    expect(cache.get("3")).to.not.be.undefined;
    expect(cache.get("4")).to.not.be.undefined;
    expect(cache.get("1")).to.equal("one");
    expect(cache.get("3")).to.equal("three");
    expect(cache.get("4")).to.equal("four");
    expect(cache.size()).to.equal(3);
  });

  it("caches and retrieves new entries", async () => {
    const cache = new OracleCache<string, string>(1);
    cache.put("1", "one");
    expect(cache.get("1")).to.not.be.undefined;
    expect(cache.get("1")).to.equal("one");
    expect(cache.size()).to.equal(1);
  });

  it("updates and retrieves existing entries", async () => {
    const cache = new OracleCache<string, string>(2);
    cache.put("1", "one");
    cache.put("1", "uno");
    expect(cache.get("1")).to.not.be.undefined;
    expect(cache.get("1")).to.equal("uno");
    expect(cache.size()).to.equal(1);
  });

  it("caches and retrieves different object entries", async () => {
    const cache = new OracleCache<Record<string, string>, string>(2);
    const cacheKey1 = { foo: "bar" };
    const cacheKey2 = { bar: "foo" };
    cache.put(cacheKey1, "foobar");
    cache.put(cacheKey2, "barfoo");
    expect(cache.get(cacheKey1)).to.not.be.undefined;
    expect(cache.get(cacheKey1)).to.equal("foobar");
    expect(cache.get(cacheKey2)).to.not.be.undefined;
    expect(cache.get(cacheKey2)).to.equal("barfoo");
    expect(cache.size()).to.equal(2);
  });

  describe("remove function", () => {
    it("removes a single entry", async () => {
      const cache = new OracleCache<string, string>(2);
      cache.put("1", "one");
      cache.put("2", "two");
      expect(cache.get("1")).to.not.be.undefined;
      expect(cache.get("2")).to.not.be.undefined;
      cache.remove("2");
      expect(cache.get("2")).to.be.undefined;
      expect(cache.get("1")).to.not.undefined;
      expect(cache.get("1")).to.equal("one");
      expect(cache.size()).to.equal(1);
    });
  });

  describe("clear function", () => {
    it("purges all entries", async () => {
      const cache = new OracleCache<string, string>(1);
      cache.put("1", "one");
      cache.clear();
      expect(cache.get("1")).to.be.undefined;
      expect(cache.size()).to.equal(0);
    });
  });

  describe("size function", () => {
    it("returns the correct entry count", async () => {
      const cache = new OracleCache<string, string>(2);
      cache.put("1", "one");
      cache.put("2", "two");
      expect(cache.size()).to.equal(2);
    });
  });

  describe("cacheKeyString function", () => {
    it("returns and input string as the same string", async () => {
      const cache = new OracleCache<string, string>(1);
      expect(cache.cacheKeyString("key")).to.equal("key");
      expect(cache.cacheKeyString('{ bad: "json"')).to.equal('{ bad: "json"');
    });

    it("returns an input number as a string", async () => {
      const cache = new OracleCache<number, string>(1);
      expect(cache.cacheKeyString(1)).to.equal("1");
    });

    it("returns an input object as its JSON representation", async () => {
      const cache = new OracleCache<Record<string, string>, string>(1);
      expect(cache.cacheKeyString({ foo: "bar" })).to.equal('{"foo":"bar"}');
    });
  });

  describe("time to live", () => {
    it("purges all entries after ttl", async () => {
      const cache = new OracleCache<string, string>(1, 10);
      cache.put("1", "one");
      await new Promise((resolve) => setTimeout(resolve, 15));
      expect(cache.get("1")).to.be.undefined;
      expect(cache.size()).to.equal(0);
    });
  });
});
