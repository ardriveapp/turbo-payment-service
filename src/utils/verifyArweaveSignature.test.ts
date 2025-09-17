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
import { JWKInterface } from "arweave/node/lib/wallet";
import { expect } from "chai";
import { ParsedUrlQuery } from "querystring";

import { signArweaveData } from "../../tests/helpers/signData";
import {
  testArweaveWallet,
  testEthereumWallet,
} from "../../tests/helpers/testHelpers";
import { toB64Url } from "./base64";
import {
  signEthereumData,
  verifyArweaveSignature,
  verifyEthereumSignature,
} from "./verifyArweaveSignature";

describe("verifyArweaveSignature", () => {
  const wallet: JWKInterface = testArweaveWallet;

  it("should pass for a valid signature without query parameters", async () => {
    const nonce =
      "should pass for a valid signature without query parameters nonce";
    const dataToSign = nonce;
    const signature = toB64Url(
      Buffer.from(await signArweaveData(wallet, dataToSign))
    );
    const { n: publicKey } = wallet;

    const isVerified = await verifyArweaveSignature({
      publicKey,
      signature,
      nonce,
    });

    expect(isVerified).to.be.true;
  });

  it("should pass for a valid signature with query parameters", async () => {
    const nonce =
      "should pass for a valid signature with query parameters nonce";
    const query: ParsedUrlQuery = {
      husky: "sings",
      shepherd: ["good", "boy"],
      corgi: "wow",
    };
    const additionalData = JSON.stringify(query);
    const { n: publicKey } = wallet;

    const signature = toB64Url(
      Buffer.from(await signArweaveData(wallet, additionalData + nonce))
    );

    const isVerified = await verifyArweaveSignature({
      publicKey,
      signature,
      additionalData,
      nonce,
    });

    expect(isVerified).to.be.true;
  });

  it("should fail for an invalid signature", async () => {
    const nonce = "should fail for an invalid signature nonce";
    const invalidSignature = "invalid_signature";
    const { n: publicKey } = wallet;

    const isVerified = await verifyArweaveSignature({
      publicKey,
      signature: invalidSignature,
      nonce,
    });

    expect(isVerified).to.be.false;
  });
});

describe("verifyEthereumSignature", () => {
  it("should pass for a valid signature", async () => {
    const nonce =
      "should pass for a valid signature without query parameters nonce";

    const signature = await signEthereumData(testEthereumWallet, nonce);
    const publicKey = testEthereumWallet.publicKey;

    const isVerified = verifyEthereumSignature(publicKey, signature, nonce);

    expect(isVerified).to.be.true;
  });
});
