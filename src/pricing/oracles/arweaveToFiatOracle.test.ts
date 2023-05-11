import { expect } from "chai";
import { stub } from "sinon";

import { expectedArPrices } from "../../../tests/helpers/stubs";
import { createAxiosInstance } from "../../axiosClient";
import {
  CoingeckoArweaveToFiatOracle,
  ReadThroughArweaveToFiatOracle,
} from "./arweaveToFiatOracle";

describe("CoingeckoArweaveToFiatOracle", () => {
  const axios = createAxiosInstance({});
  const oracle = new CoingeckoArweaveToFiatOracle(axios);

  describe("getFiatPricesForOneAR", () => {
    it("should return a an object for the AR price with each supported fiat currency", async () => {
      stub(axios, "get").resolves({
        data: expectedArPrices,
      });

      const arPrices = await oracle.getFiatPricesForOneAR();
      expect(arPrices).to.deep.equal(expectedArPrices.arweave);
    });
  });
});

describe("ReadThroughArweaveToFiatOracle", () => {
  const axios = createAxiosInstance({});
  const oracle = new CoingeckoArweaveToFiatOracle(axios);

  const readThroughOracle = new ReadThroughArweaveToFiatOracle({ oracle });

  describe("getFiatPriceForOneAR", () => {
    it("should return a an object for the AR price with each supported fiat currency", async () => {
      stub(axios, "get").resolves({
        data: expectedArPrices,
      });

      const arPrice = await readThroughOracle.getFiatPriceForOneAR("usd");
      expect(arPrice).to.equal(expectedArPrices.arweave.usd);
    });
  });
});
