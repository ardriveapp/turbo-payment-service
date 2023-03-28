import Arweave from "arweave";
import { expect } from "chai";

import { testWallet } from "../../tests/helpers/testHelpers";
import { jwkToPem, pemToJwk, publicPemToArweaveAddress } from "./pem";

describe("pem", () => {
  describe("jwkToPem", () => {
    it("should convert a JWK to PEM format", async () => {
      const jwk = await Arweave.crypto.generateJWK();
      const pem = jwkToPem(jwk);

      expect(pem).to.be.a("string");
      expect(pem).to.include("-----BEGIN RSA PRIVATE KEY-----");
      expect(pem).to.include("-----END RSA PRIVATE KEY-----");
    });

    it("should convert a public JWK to PEM format", async () => {
      const jwk = await Arweave.crypto.generateJWK();

      jwk.d = undefined; // remove the private key property to make it a public key
      const pem = jwkToPem(jwk);

      expect(pem).to.be.a("string");
      expect(pem).to.include("-----BEGIN RSA PUBLIC KEY-----");
      expect(pem).to.include("-----END RSA PUBLIC KEY-----");
    });
  });

  describe("pemToJwk", () => {
    it("should convert a PEM to JWK format", async () => {
      const jwk = await Arweave.crypto.generateJWK();

      const pem = jwkToPem(jwk);
      const jwkFromPem = pemToJwk(pem);

      expect(jwkFromPem).to.be.an("object");
      expect(jwkFromPem).to.have.property("kty", "RSA");
      expect(jwkFromPem).to.have.property("n");
      expect(jwkFromPem).to.have.property("e");
      expect(jwkFromPem).to.have.property("d");
      expect(jwkFromPem).to.have.property("p");
      expect(jwkFromPem).to.have.property("q");
      expect(jwkFromPem).to.have.property("dp");
      expect(jwkFromPem).to.have.property("dq");
      expect(jwkFromPem).to.have.property("qi");
    });

    it("should convert a public PEM to JWK format", async () => {
      const jwk = await Arweave.crypto.generateJWK();

      const pem = jwkToPem(jwk, true);
      const jwkFromPem = pemToJwk(pem, true);

      expect(jwkFromPem).to.be.an("object");
      expect(jwkFromPem).to.have.property("kty", "RSA");
      expect(jwkFromPem).to.have.property("n");
      expect(jwkFromPem).to.have.property("e");
    });
  });

  it("publicPemToArweaveAddress", async () => {
    const wallet = testWallet;
    const knownWalletAddress = "-kYy3_LcYeKhtqNNXDN6xTQ7hW8S5EV0jgq_6j8a830";

    const publicPem = jwkToPem(wallet, true);
    const computedAddress = await publicPemToArweaveAddress(publicPem);
    expect(computedAddress).to.equal(knownWalletAddress);
  });
});
