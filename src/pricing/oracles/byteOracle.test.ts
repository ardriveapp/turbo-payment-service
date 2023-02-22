import { expect } from "chai";

import { ArweaveBytesToAROracle } from "./bytesToAROracle";

describe("ArweaveBytesToAROracle", () => {
  describe("getARForBytes", () => {
    it("should return a number for valid bytes", async () => {
      const oracle = new ArweaveBytesToAROracle();
      const arPrice = await oracle.getARForBytes(1024);
      expect(arPrice).to.be.a("number");
    });

    it("should throw an error for invalid bytes", async () => {
      const oracle = new ArweaveBytesToAROracle();
      try {
        await oracle.getARForBytes(-1);
        expect.fail("The function should throw an error");
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it("should cache the result for bytes", async () => {
      const oracle = new ArweaveBytesToAROracle();
      const bytes = 1024;
      const arPrice1 = await oracle.getARForBytes(bytes);
      const arPrice2 = await oracle.getARForBytes(bytes);
      expect(arPrice1).to.equal(arPrice2);
    });

    it("should not cache the result for different bytes", async () => {
      const oracle = new ArweaveBytesToAROracle();
      const bytes1 = 1024;
      const bytes2 = 2048;
      const arPrice1 = await oracle.getARForBytes(bytes1);
      const arPrice2 = await oracle.getARForBytes(bytes2);
      expect(arPrice1).to.not.equal(arPrice2);
    });
  });
});
