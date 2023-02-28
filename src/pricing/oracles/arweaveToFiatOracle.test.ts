import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { expect } from "chai";

import { CoingeckoArweaveToFiatOracle } from "./arweaveToFiatOracle";

describe("CoingeckoArweaveToFiatOracle", () => {
  const mock = new MockAdapter(axios);

  afterEach(() => {
    mock.reset();
  });
  describe("getFiatPriceForOneAR", () => {
    it("should return a number for valid fiat currency", async () => {
      const oracle = new CoingeckoArweaveToFiatOracle();
      const expectedPrice = 1.23;
      mock
        .onGet(
          "https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd"
        )
        .reply(200, {
          arweave: {
            usd: expectedPrice,
          },
        });
      const arPrice = await oracle.getFiatPriceForOneAR("usd");
      expect(arPrice).to.equal(expectedPrice);
    });

    it("should throw an error for an invalid fiat currency", async () => {
      // COINGECKO API returns an empty object with status 200 for invalid fiat currencies
      const oracle = new CoingeckoArweaveToFiatOracle();
      mock.onGet().reply(200, { arweave: {} });

      try {
        await oracle.getFiatPriceForOneAR("invalid-fiat");
        expect.fail("Error: coingecko returned bad response undefined");
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });
});
