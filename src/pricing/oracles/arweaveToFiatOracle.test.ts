import { expect } from "chai";
import { stub } from "sinon";

import { createAxiosInstance } from "../../axiosClient";
import {
  CoingeckoArweaveToFiatOracle,
  ReadThroughArweaveToFiatOracle,
} from "./arweaveToFiatOracle";

const expectedArPrices = {
  arweave: {
    usd: 7.02,
    aed: 25.78,
    ars: 1604.35,
    aud: 10.36,
    bdt: 754.47,
    bmd: 7.02,
    brl: 34.72,
    cad: 9.39,
    chf: 6.25,
    clp: 5528.94,
    cny: 48.68,
    czk: 149.96,
    dkk: 47.61,
    eur: 6.39,
    gbp: 5.56,
    hkd: 54.99,
    huf: 2362.82,
    idr: 103201,
    ils: 25.61,
    inr: 575.23,
    jpy: 943.32,
    krw: 9256.61,
    lkr: 2224.06,
    mmk: 14756.72,
    mxn: 123.3,
    myr: 31.26,
    ngn: 3239.16,
    nok: 73.8,
    nzd: 11.03,
    php: 391.16,
    pkr: 1997.69,
    pln: 28.89,
    rub: 534.4,
    sar: 26.33,
    sek: 71.75,
    sgd: 9.31,
    thb: 236,
    try: 137.24,
    twd: 215.55,
    uah: 258.2,
    vnd: 164811,
    zar: 132.44,
  },
};

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
