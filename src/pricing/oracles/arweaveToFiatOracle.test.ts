import { expect } from "chai";
import { stub } from "sinon";

import { expectedArPrices } from "../../../tests/helpers/stubs";
import { createAxiosInstance } from "../../axiosClient";
import { supportedPaymentCurrencyTypes } from "../../types/supportedCurrencies";
import {
  CoingeckoArweaveToFiatOracle,
  ReadThroughArweaveToFiatOracle,
} from "./arweaveToFiatOracle";

describe("CoingeckoArweaveToFiatOracle", () => {
  const axios = createAxiosInstance({});
  const oracle = new CoingeckoArweaveToFiatOracle(axios);

  describe("getFiatPricesForOneAR", () => {
    it("should return an object for the AR price with each supported fiat currency", async () => {
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
    it("should return the AR price for each supported fiat currency", async () => {
      stub(axios, "get").resolves({
        data: expectedArPrices,
      });

      for (const curr of supportedPaymentCurrencyTypes) {
        const arPrice = await readThroughOracle.getFiatPriceForOneAR(curr);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        expect(arPrice).to.equal(expectedArPrices.arweave[curr]);
      }
    });
  });
});
