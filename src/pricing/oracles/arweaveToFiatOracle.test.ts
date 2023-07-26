/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
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
        expect(arPrice).to.equal(expectedArPrices.arweave[curr]);
      }
    });
  });
});
