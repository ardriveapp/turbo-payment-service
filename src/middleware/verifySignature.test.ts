import Arweave from "arweave";
import { JWKInterface } from "arweave/node/lib/wallet";
import { expect } from "chai";
import { ParsedUrlQuery } from "querystring";

import { signData } from "../../tests/helpers/signData";
import { testWallet } from "../../tests/helpers/testHelpers";
import { jwkToPem } from "../utils/pem";
import { verifyArweaveSignature } from "./verifySignature";

describe("verifyArweaveSignature", () => {
  let wallet: JWKInterface = testWallet;

  it("should pass for a valid signature without query parameters", async () => {
    const nonce =
      "should pass for a valid signature without query parameters nonce";
    const dataToSign = nonce;
    const signature = await signData(jwkToPem(wallet), dataToSign);

    const publicKey = jwkToPem(wallet, true);

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
    const signature = await signData(jwkToPem(wallet), additionalData + nonce);

    const publicKey = jwkToPem(wallet, true);
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
    const publicKey = jwkToPem(wallet, true);

    const isVerified = await verifyArweaveSignature({
      publicKey,
      signature: Arweave.utils.stringToBuffer(invalidSignature),
      nonce,
    });

    expect(isVerified).to.be.false;
  });
});
