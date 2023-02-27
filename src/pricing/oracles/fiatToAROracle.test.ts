import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { expect } from "chai";

import { CoingeckoFiatToAROracle } from "./fiatToAROracle";

describe("CoingeckoFiatToAROracle", () => {
  const axiosInstance = axios.create();
  const mock = new MockAdapter(axiosInstance);

  afterEach(() => {
    mock.reset();
  });
  describe("getARForFiat", () => {
    it("should return a number for valid fiat currency", async () => {
      const oracle = new CoingeckoFiatToAROracle(axiosInstance);
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
      const arPrice = await oracle.getARForFiat("usd");
      expect(arPrice).to.be.a("number");
    });

    it("should throw an error for an invalid fiat currency", async () => {
      // COINGECKO API returns an empty object with status 200 for invalid fiat currencies
      const oracle = new CoingeckoFiatToAROracle(axiosInstance);
      mock.onGet().reply(200, { arweave: {} });

      try {
        await oracle.getARForFiat("invalid-fiat");
        expect.fail("The function should throw an error");
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });
});
