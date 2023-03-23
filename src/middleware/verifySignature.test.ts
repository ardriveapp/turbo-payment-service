import Arweave from "arweave";
import { JWKInterface } from "arweave/node/lib/wallet";
import { expect } from "chai";
import { ParsedUrlQuery } from "querystring";

import { jwkToPem } from "../utils/pem";
import { verifyArweaveSignature } from "./verifySignature";

describe("verifyArweaveSignature", () => {
  let wallet: JWKInterface;

  before(async () => {
    wallet = await Arweave.crypto.generateJWK();
  });

  it("should pass for a valid signature without query parameters", async () => {
    const nonce =
      "should pass for a valid signature without query parameters nonce";
    const dataToSign = nonce;
    const signature = await Arweave.crypto.sign(
      wallet,
      Arweave.utils.stringToBuffer(dataToSign)
    );

    console.log("signature", signature);

    const publicKey = jwkToPem(wallet);

    console.log("publicKey", publicKey);

    const isVerified = await verifyArweaveSignature(
      publicKey,
      signature,
      undefined,
      nonce
    );

    expect(isVerified).to.be.true;
  });

  it("should pass for a valid signature with query parameters", async () => {
    const nonce =
      "should pass for a valid signature with query parameters nonce";
    const query: ParsedUrlQuery = { key: "value" };
    const dataToSign = JSON.stringify(query);
    const signature = await Arweave.crypto.sign(
      wallet,
      Buffer.from(dataToSign)
    );
    const publicKey = jwkToPem(wallet);

    const isVerified = await verifyArweaveSignature(
      publicKey,
      signature,
      dataToSign,
      nonce
    );

    expect(isVerified).to.be.true;
  });

  it("should fail for an invalid signature", async () => {
    const nonce = "should fail for an invalid signature nonce";
    const invalidSignature = "invalid_signature";
    const publicKey = jwkToPem(wallet);

    const isVerified = await verifyArweaveSignature(
      publicKey,
      Arweave.utils.stringToBuffer(invalidSignature),
      undefined,
      nonce
    );

    expect(isVerified).to.be.false;
  });
});
