import { Base64URLString } from "../types";

export function fromB64UrlToBuffer(input: Base64URLString): Buffer {
  return Buffer.from(input, "base64url");
}

export function toB64Url(buffer: Buffer): Base64URLString {
  return buffer.toString("base64url");
}

// check if it is a valid arweave base64url for a wallet public address, transaction id or smartweave contract
export function isValidArweaveBase64URL(base64URL: string) {
  const base64URLRegex = new RegExp("^[a-zA-Z0-9_-]{43}$");
  return base64URLRegex.test(base64URL);
}
