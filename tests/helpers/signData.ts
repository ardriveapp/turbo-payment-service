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
import { SignatureConfig } from "@dha-team/arbundles";
import Arweave from "arweave/node/common";
import { stringToBuffer } from "arweave/node/lib/utils";
import { RawAxiosRequestHeaders } from "axios";
import { Buffer } from "buffer";
import { randomUUID } from "crypto";
import { HDNodeWallet } from "ethers";

import { JWKInterface } from "../../src/types/jwkTypes";
import { toB64Url } from "../../src/utils/base64";
import { signEthereumData } from "../../src/utils/verifyArweaveSignature";

export async function signArweaveData(
  jwk: JWKInterface,
  dataToSign: string
): Promise<Uint8Array> {
  return await Arweave.crypto.sign(jwk, stringToBuffer(dataToSign), {
    saltLength: 0, // We do not need to salt the signature since we combine with a random UUID
  });
}

export async function signedRequestHeadersFromJwk(
  jwk: JWKInterface,
  nonce: string = randomUUID(),
  data = ""
): Promise<RawAxiosRequestHeaders> {
  const signature = await signArweaveData(jwk, data + nonce);

  return {
    "x-public-key": jwk.n,
    "x-nonce": nonce,
    "x-signature": toB64Url(Buffer.from(signature)),
  };
}

export async function signedRequestHeadersFromEthWallet(
  wallet: HDNodeWallet,
  nonce: string = randomUUID(),
  data = ""
): Promise<RawAxiosRequestHeaders> {
  const signature = await signEthereumData(wallet, data + nonce);

  return {
    "x-public-key": wallet.publicKey,
    "x-nonce": nonce,
    "x-signature": signature,
    "x-signature-type": SignatureConfig.ETHEREUM,
  };
}
