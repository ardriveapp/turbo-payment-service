import { b64UrlToBuffer } from "arweave/node/lib/utils";
import { Buffer } from "buffer";
import { createHash } from "crypto";

import { RSAModulusString } from "../types/types";
import { toB64Url } from "./base64";

// TODO: create a factory that returns address for various wallet types (Arweave, ETH, SOL)
export async function arweaveRSAModulusToAddress(
  modulus: RSAModulusString
): Promise<string> {
  const hash = createHash("sha256");
  hash.update(b64UrlToBuffer(modulus));
  const result = new Uint8Array(hash.digest());
  return toB64Url(Buffer.from(result));
}
