import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { expect } from "chai";

import { ArweaveBytesToAROracle } from "./bytesToAROracle";

describe("ArweaveBytesToAROracle", () => {
  describe("getARForBytes", () => {
    const axiosInstance = axios.create();
    const mock = new MockAdapter(axiosInstance);

    afterEach(() => {
      mock.reset();
    });

    it("should return a number for valid bytes", async () => {
      const oracle = new ArweaveBytesToAROracle(axiosInstance);
      const bytes = 1024;
      const chunkSize = oracle.roundToChunkSize(bytes);
      const expectedPrice = 1.23;
      mock
        .onGet(`https://arweave.net/price/${chunkSize}`)
        .reply(200, expectedPrice);
      const arPrice = await oracle.getARForBytes(bytes);
      expect(arPrice).to.equal(expectedPrice);
    });

    it("should cache the result for bytes", async () => {
      const oracle = new ArweaveBytesToAROracle(axiosInstance);
      const bytes = 1024;
      const chunkSize = oracle.roundToChunkSize(bytes);
      const expectedPrice = 1.23;
      mock
        .onGet(`https://arweave.net/price/${chunkSize}`)
        .reply(200, expectedPrice);
      const arPrice1 = await oracle.getARForBytes(bytes);
      const arPrice2 = await oracle.getARForBytes(bytes);
      expect(arPrice1).to.equal(arPrice2);
      expect(mock.history.get.length).to.equal(1);
    });

    it("should not cache the result for different bytes", async () => {
      const oracle = new ArweaveBytesToAROracle(axiosInstance);
      const bytes1 = 1024;
      const chunkSize1 = oracle.roundToChunkSize(bytes1);
      const bytes2 = 512 * 1024;
      const chunkSize2 = oracle.roundToChunkSize(bytes2);
      const expectedPrice1 = 1.23;
      const expectedPrice2 = 4.56;
      mock
        .onGet(`https://arweave.net/price/${chunkSize1}`)
        .reply(200, expectedPrice1);
      mock
        .onGet(`https://arweave.net/price/${chunkSize2}`)
        .reply(200, expectedPrice2);
      const arPrice1 = await oracle.getARForBytes(bytes1);
      const arPrice2 = await oracle.getARForBytes(bytes2);
      expect(arPrice1).to.not.equal(arPrice2);
      expect(mock.history.get.length).to.equal(2);
    });
  });
});
