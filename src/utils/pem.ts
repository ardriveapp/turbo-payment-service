import { JWKInterface } from "arweave/node/lib/wallet";
import { createPrivateKey, createPublicKey } from "crypto";

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
