import { Base64String } from "../types/types";

export function fromB64UrlToBuffer(input: Base64String): Buffer {
  return Buffer.from(input, "base64");
}

export function toB64Url(buffer: Buffer): Base64String {
  return buffer.toString("base64url");
}
