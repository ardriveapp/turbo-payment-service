import { b64UrlToBuffer } from "arweave/node/lib/utils";
import { Buffer } from "buffer";
import { createHash } from "crypto";

import { toB64Url } from "./base64";

type Base64UrlString = string;

// TODO: create a factory that returns address for various wallet types (Arweave, ETH, SOL)
export async function arweaveRSAModulusToAddress(
  modulus: Base64UrlString
): Promise<string> {
  const hash = createHash("sha256");
  hash.update(b64UrlToBuffer(modulus));
  const result = new Uint8Array(hash.digest());
  return toB64Url(Buffer.from(result));
}
