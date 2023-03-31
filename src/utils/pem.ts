import { createHash, createPrivateKey, createPublicKey } from "crypto";

import { JWKInterface } from "../types/jwkTypes";
import { fromB64UrlToBuffer, toB64Url } from "./base64";

export function jwkToPem(jwk: JWKInterface, makePublicKey?: boolean): string {
  const isPrivate = makePublicKey === true ? false : !!jwk.d;

  const jwkAsUnknown = jwk as unknown;
  const jwkAsString = jwkAsUnknown as string;
  const jwkKeyObject = isPrivate
    ? createPrivateKey({ key: jwkAsString, format: "jwk" })
    : createPublicKey({ key: jwkAsString, format: "jwk" });

  return jwkKeyObject.export({ format: "pem", type: "pkcs1" }).toString();
}

export async function publicPemToArweaveAddress(
  publicPem: string
): Promise<string> {
  const jwk = pemToJwk(publicPem, true);
  const owner = jwk.n;

  const address: Buffer = await new Promise((resolve) => {
    resolve(createHash("SHA-256").update(fromB64UrlToBuffer(owner)).digest());
  });

  return toB64Url(address);
}

export function pemToJwk(pem: string, makePublicKey = false): JWKInterface {
  const isPrivate = makePublicKey
    ? false
    : pem.includes("-----BEGIN RSA PRIVATE KEY-----");
  const pubKey = isPrivate
    ? createPrivateKey({ key: pem, format: "pem" })
    : createPublicKey({ key: pem, format: "pem" });

  return pubKey.export({ format: "jwk" }) as JWKInterface;
}
