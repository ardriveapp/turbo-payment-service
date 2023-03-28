import { createHash, createPrivateKey, createPublicKey } from "crypto";

import { JWKInterface } from "../types/jwkTypes";
import { fromB64UrlToBuffer, toB64Url } from "./base64";

export function jwkToPem(jwk: JWKInterface, makePublicKey?: boolean): string {
  const isPrivate = makePublicKey === true ? false : !!jwk.d;

  const jwkKeyObject = isPrivate
    ? // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      createPrivateKey({ key: jwk as unknown as string, format: "jwk" })
    : // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      createPublicKey({ key: jwk as unknown as string, format: "jwk" });

  return jwkKeyObject.export({ format: "pem", type: "pkcs1" }).toString();
}

export async function publicPemToArweaveAddress(
  publicKey: string
): Promise<string> {
  const jwk = pemToJwk(publicKey, true);
  const owner = jwk.n;

  const address: Buffer = await new Promise((resolve) => {
    resolve(createHash("SHA-256").update(fromB64UrlToBuffer(owner)).digest());
  });

  return toB64Url(address);
}

export function pemToJwk(pem: string, makePublicKey?: boolean): JWKInterface {
  const isPrivate =
    makePublicKey === true
      ? false
      : pem.includes("-----BEGIN RSA PRIVATE KEY-----");
  const pubKey = isPrivate
    ? createPrivateKey({ key: pem, format: "pem" })
    : createPublicKey({ key: pem, format: "pem" });

  return pubKey.export({ format: "jwk" }) as JWKInterface;
}
