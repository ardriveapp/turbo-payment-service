/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
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
