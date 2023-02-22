import { expect } from "chai";

import { CoingeckoFiatToAROracle } from "./fiatToAROracle";

describe("CoingeckoFiatToAROracle", () => {
  describe("getARForFiat", () => {
    it("should return a number for valid fiat currency", async () => {
      const oracle = new CoingeckoFiatToAROracle();
      const arPrice = await oracle.getARForFiat("usd");
      expect(arPrice).to.be.a("number");
    });

    it("should throw an error for an invalid fiat currency", async () => {
      const oracle = new CoingeckoFiatToAROracle();
      try {
        await oracle.getARForFiat("invalid-fiat");
        expect.fail("The function should throw an error");
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it("should cache the result for a fiat currency", async () => {
      const oracle = new CoingeckoFiatToAROracle();
      const fiat = "usd";
      const arPrice1 = await oracle.getARForFiat(fiat);
      const arPrice2 = await oracle.getARForFiat(fiat);
      expect(arPrice1).to.equal(arPrice2);
    });

    it("should not cache the result for a different fiat currency", async () => {
      const oracle = new CoingeckoFiatToAROracle();
      const fiat1 = "usd";
      const fiat2 = "eur";
      const arPrice1 = await oracle.getARForFiat(fiat1);
      const arPrice2 = await oracle.getARForFiat(fiat2);
      expect(arPrice1).to.not.equal(arPrice2);
    });
  });
});
