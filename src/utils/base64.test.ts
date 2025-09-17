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

import { stubArweaveUserAddress } from "../../tests/dbTestHelper";
import { isValidSolanaAddress } from "./base64";

describe("isValidSolanaAddress", () => {
  // cspell: disable
  const validAddresses = [
    "AHpBdKdA9jjg2TkhXg3muAUJmAKgYnatvCoTRjxs1PT", // 43 characters
    "2cor8AZxm38uc9sVgGaXk4BU2EtB18FqwEq7ivwa7VUa", // 44 characters
    "5ZPxT1WHxxjfLWd9MUfrkM5TAYKoeFRhW9shUe5UJfKD",
    "8f7oVbLCqgVtUNcG5HNDZhveghmyrnAmUEGRVhxTpsn7",
    "6u4pTQxKz4LpYpQ7ufgcm9VtSZr2cHye1sRXab5bQ6cn",
  ]; // cspell: enable

  for (const address of validAddresses) {
    it(`should return true for valid address: ${address}`, () => {
      expect(isValidSolanaAddress(address)).to.be.true;
    });
  }

  const invalidAddresses = [
    "pants",
    stubArweaveUserAddress,
    "11111111111111111111111111111111111111111111",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    // cspell: disable
    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "3HvrvWCrpPftVJxWzR4FXDqPrVxM2nLu",
    "3u1CfTpGpB",
    "5KLvDovpEZDvh3ohmK1J2Md5u2FGEV3qrPfXaE4HZ46U2yPqP9",
    "1I2O3l4A5BCDEFGHIJKLMN0PQRSTUVWXYZabcdefg",
    "3f5h4JHkD5T3gNh9MH5mQFSXUj5iV4j2G1Rm4F2oq6XB", // not on curve
    "3HvrvWCrpPftVJxWzR4FXDqPrVxM2nLu5", // 33 characters
    "2cor8AZxm38uc9sVgGaXk4BU2EtB18FqwEq7ivwa7VUa5", // 45 characters
  ]; // cspell: enable

  for (const address of invalidAddresses) {
    it(`should return false for invalid address: ${address}`, () => {
      expect(isValidSolanaAddress(address)).to.be.false;
    });
  }
});
