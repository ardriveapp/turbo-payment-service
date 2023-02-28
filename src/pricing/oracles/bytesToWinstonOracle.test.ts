import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import BigNumber from "bignumber.js";
import { expect } from "chai";

import { ArweaveBytesToWinstonOracle } from "./bytesToWinstonOracle";

describe("ArweaveBytesToWinstonOracle", () => {
  describe("getWinstonForBytes", () => {
    const mock = new MockAdapter(axios);

    afterEach(() => {
      mock.reset();
    });

    it("should return a number for valid bytes", async () => {
      const oracle = new ArweaveBytesToWinstonOracle();
      const bytes = 1024;
      const chunkSize = oracle.roundToChunkSize(bytes);
      const expectedPrice = BigNumber(31205630);
      mock
        .onGet(`https://arweave.net/price/${chunkSize}`)
        .reply(200, expectedPrice);
      const arPrice = await oracle.getWinstonForBytes(bytes);
      expect(arPrice.toNumber).to.equal(expectedPrice.toNumber);
    });

    it("should throw if it gets an invalid response", async () => {
      const oracle = new ArweaveBytesToWinstonOracle();
      const bytes = 1024;
      const chunkSize = oracle.roundToChunkSize(bytes);
      const expectedPrice = "RandomString";
      mock
        .onGet(`https://arweave.net/price/${chunkSize}`)
        .reply(200, expectedPrice);
      try {
        await oracle.getWinstonForBytes(bytes);
        expect.fail("Error: arweave.net returned bad response RandomString");
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });
});
