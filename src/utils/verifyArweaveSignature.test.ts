import { expect } from "chai";
import { ParsedUrlQuery } from "querystring";

import { signData } from "../../tests/helpers/signData";
import { testWallet } from "../../tests/helpers/testHelpers";
import { JWKInterface } from "../types/jwkTypes";
import { fromB64UrlToBuffer } from "./base64";
import { jwkToPem } from "./pem";
import { verifyArweaveSignature } from "./verifyArweaveSignature";

describe("verifyArweaveSignature", () => {
  let wallet: JWKInterface = testWallet;

  it("should pass for a valid signature without query parameters", async () => {
    const nonce =
      "should pass for a valid signature without query parameters nonce";
    const dataToSign = nonce;
    const signature = await signData(jwkToPem(wallet), dataToSign);

    const publicPem = jwkToPem(wallet, true);

    const isVerified = await verifyArweaveSignature({
      publicPem,
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

    const publicPem = jwkToPem(wallet, true);
    const isVerified = await verifyArweaveSignature({
      publicPem,
      signature,
      additionalData,
      nonce,
    });

    expect(isVerified).to.be.true;
  });

  it("should fail for an invalid signature", async () => {
    const nonce = "should fail for an invalid signature nonce";
    const invalidSignature = "invalid_signature";
    const publicPem = jwkToPem(wallet, true);

    const isVerified = await verifyArweaveSignature({
      publicPem,
      signature: fromB64UrlToBuffer(invalidSignature),
      nonce,
    });

    expect(isVerified).to.be.false;
  });
});
