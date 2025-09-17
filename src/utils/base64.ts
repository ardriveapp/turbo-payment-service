/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";

import { UserAddressType, userAddressTypes } from "../database/dbTypes";
import { Base64URLString, PublicArweaveAddress } from "../types";

export function ownerToAddress(owner: Base64URLString): PublicArweaveAddress {
  return sha256B64Url(fromB64Url(owner));
}

export function fromB64Url(input: Base64URLString) {
  const paddingLength = input.length % 4 == 0 ? 0 : 4 - (input.length % 4);

  const base64 = input
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .concat("=".repeat(paddingLength));

  return Buffer.from(base64, "base64");
}

export function fromB64UrlToBuffer(input: Base64URLString): Buffer {
  return Buffer.from(input, "base64url");
}

export function toB64Url(buffer: Buffer): Base64URLString {
  return buffer.toString("base64url");
}

export function sha256B64Url(input: Buffer): Base64URLString {
  return toB64Url(createHash("sha256").update(input).digest());
}

// check if it is a valid arweave base64url for a wallet public address, transaction id or smartweave contract
export function isValidArweaveBase64URL(base64URL: Base64URLString) {
  const base64URLRegex = new RegExp("^[a-zA-Z0-9_-]{43}$");
  return base64URLRegex.test(base64URL);
}

export function isValidSolanaAddress(address: string) {
  try {
    return PublicKey.isOnCurve(address);
  } catch {
    return false;
  }
}

export function isValidEthAddress(address: string) {
  const ethAddressRegex = new RegExp("^0x[a-fA-F0-9]{40}$");
  return ethAddressRegex.test(address);
}

export function isValidMaticAddress(address: string) {
  const maticAddressRegex = new RegExp("^0x[a-fA-F0-9]{40}$");
  return maticAddressRegex.test(address);
}

export function isValidKyveAddress(address: string) {
  const kyveAddressRegex = new RegExp("^kyve[a-zA-Z0-9]{39}$");
  return kyveAddressRegex.test(address);
}

export function isValidUserAddress(
  address: string,
  type: UserAddressType
): boolean {
  switch (type) {
    case "arweave":
    case "ario":
      return isValidArweaveBase64URL(address);
    case "solana":
    case "ed25519":
      return isValidSolanaAddress(address);
    case "ethereum":
    case "base-eth":
      return isValidEthAddress(address);
    case "kyve":
      return isValidKyveAddress(address);
    case "matic":
    case "pol":
      return isValidMaticAddress(address);
  }
}

export function isAnyValidUserAddress(address: string): boolean {
  for (const type of userAddressTypes) {
    if (isValidUserAddress(address, type)) {
      return true;
    }
  }
  return false;
}
