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
