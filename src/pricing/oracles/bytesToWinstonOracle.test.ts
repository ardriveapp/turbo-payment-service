import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import BigNumber from "bignumber.js";
import { expect } from "chai";

import { ByteCount, Winston } from "../../types";
import { roundToArweaveChunkSize } from "../../utils/roundToChunkSize";
import { ArweaveBytesToWinstonOracle } from "./bytesToWinstonOracle";

describe("ArweaveBytesToWinstonOracle", () => {
  describe("getWinstonForBytes", () => {
    let mock: MockAdapter;
    beforeEach(() => {
      mock = new MockAdapter(axios);
    });

    afterEach(() => {
      mock.restore();
    });

    it("should return a number for valid bytes", async () => {
      const oracle = new ArweaveBytesToWinstonOracle({ retries: 0 });
      const bytes = ByteCount(1024);
      const expectedPrice = new Winston(BigNumber(31205630));
      mock
        .onGet(`https://arweave.net/price/${bytes}`)
        .reply(200, expectedPrice);
      const arPrice = await oracle.getWinstonForBytes(bytes);
      expect(arPrice).to.deep.equal(expectedPrice);
    });

    it("should throw if it gets an invalid response", async () => {
      const oracle = new ArweaveBytesToWinstonOracle();
      const bytes = ByteCount(1024);
      const chunkSize = roundToArweaveChunkSize(bytes);
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
