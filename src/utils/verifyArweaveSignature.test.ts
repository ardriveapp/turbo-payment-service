import { JWKInterface } from "arweave/node/lib/wallet";
import { expect } from "chai";
import { ParsedUrlQuery } from "querystring";

import { signData } from "../../tests/helpers/signData";
import { testWallet } from "../../tests/helpers/testHelpers";
import { fromB64UrlToBuffer } from "./base64";
import { verifyArweaveSignature } from "./verifyArweaveSignature";

describe("verifyArweaveSignature", () => {
  const wallet: JWKInterface = testWallet;

  it("should pass for a valid signature without query parameters", async () => {
    const nonce =
      "should pass for a valid signature without query parameters nonce";
    const dataToSign = nonce;
    const signature = await signData(wallet, dataToSign);
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

    const signature = await signData(wallet, additionalData + nonce);

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
      signature: fromB64UrlToBuffer(invalidSignature),
      nonce,
    });

    expect(isVerified).to.be.false;
  });
});
