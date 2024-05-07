/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
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

import { expectedTokenPrices } from "../../../tests/helpers/stubs";
import { createAxiosInstance } from "../../axiosClient";
import { supportedFiatPaymentCurrencyTypes } from "../../types/supportedCurrencies";
import {
  CoingeckoTokenToFiatOracle,
  ReadThroughTokenToFiatOracle,
} from "./tokenToFiatOracle";

describe("CoingeckoTokenToFiatOracle", () => {
  const axios = createAxiosInstance({});
  const oracle = new CoingeckoTokenToFiatOracle(axios);

  describe("getFiatPricesForOneToken", () => {
    it("should return an object for the AR price with each supported fiat currency", async () => {
      stub(axios, "get").resolves({
        data: expectedTokenPrices,
      });

      const arPrices = await oracle.getFiatPricesForOneToken();
      expect(arPrices).to.deep.equal(expectedTokenPrices);
    });
  });
});

describe("ReadThroughTokenToFiatOracle", () => {
  const axios = createAxiosInstance({});
  const oracle = new CoingeckoTokenToFiatOracle(axios);

  const readThroughOracle = new ReadThroughTokenToFiatOracle({ oracle });

  describe("getFiatPriceForOneAR", () => {
    it("should return the AR price for each supported fiat currency", async () => {
      stub(axios, "get").resolves({
        data: expectedTokenPrices,
      });

      for (const curr of supportedFiatPaymentCurrencyTypes) {
        const arPrice = await readThroughOracle.getFiatPriceForOneAR(curr);
        expect(arPrice).to.equal(expectedTokenPrices.arweave[curr]);
      }
    });
  });
});
