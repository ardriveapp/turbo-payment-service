import { createHash } from "crypto";

import { JWKInterface } from "../types/jwkTypes";
import { Base64String, PublicArweaveAddress } from "../types/types";

export function jwkToPublicArweaveAddress(
  jwk: JWKInterface
): PublicArweaveAddress {
  return ownerToAddress(jwk.n);
}

export function ownerToAddress(owner: Base64String): PublicArweaveAddress {
  return sha256B64Url(fromB64Url(owner));
}

export function fromB64Url(input: Base64String): Buffer {
  return Buffer.from(input, "base64");
}

export function toB64Url(buffer: Buffer): Base64String {
  return buffer.toString("base64url");
}

export function sha256B64Url(input: Buffer): Base64String {
  return toB64Url(createHash("sha256").update(input).digest());
}
