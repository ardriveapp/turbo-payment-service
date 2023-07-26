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
import Arweave from "arweave/node/common.js";
import { stringToBuffer } from "arweave/node/lib/utils";

import { PublicKeyString } from "../types";

export interface VerifySignatureParams {
  publicKey: PublicKeyString;
  signature: Uint8Array;
  additionalData?: string;
  nonce: string;
}

// TODO: turn this into a class/factory function that can validate a data signature of other wallets (ETH, SOL)
export async function verifyArweaveSignature({
  publicKey,
  signature,
  additionalData,
  nonce,
}: VerifySignatureParams): Promise<boolean> {
  const dataToVerify = additionalData ? additionalData + nonce : nonce;
  const data = stringToBuffer(dataToVerify);
  const isVerified = await Arweave.crypto.verify(publicKey, data, signature);
  return isVerified;
}
