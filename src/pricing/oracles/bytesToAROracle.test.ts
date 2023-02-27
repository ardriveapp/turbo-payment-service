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
  });
});
