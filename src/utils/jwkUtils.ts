import { b64UrlToBuffer } from "arweave/node/lib/utils";
import { Buffer } from "buffer";
import { KeyObject, createHash, createPublicKey } from "crypto";

import { fromB64UrlToBuffer, toB64Url } from "./base64";

export async function publicKeyToAddress(publicKey: string): Promise<string> {
  const hash = createHash("sha256");
  hash.update(b64UrlToBuffer(publicKey));
  const result = new Uint8Array(hash.digest());
  return toB64Url(Buffer.from(result));
}

export function headerToPublicKey(b64UrlHeader: string): KeyObject {
  const jwk = JSON.parse(fromB64UrlToBuffer(b64UrlHeader).toString());
  return createPublicKey({
    key: {
      ...jwk,
      kty: "RSA",
    },
    format: "jwk",
  });
}
