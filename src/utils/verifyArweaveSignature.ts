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
import Arweave from "arweave/node/common.js";
import { stringToBuffer } from "arweave/node/lib/utils";
import {
  HDNodeWallet,
  computeAddress,
  verifyMessage as verifyEthereumMessage,
} from "ethers";
import crypto from "node:crypto";

import { PublicKeyString } from "../types";
import { fromB64UrlToBuffer, toB64Url } from "./base64";
import { arweaveRSAModulusToAddress } from "./jwkUtils";

export interface VerifySignatureParams {
  publicKey: PublicKeyString;
  signature: string;
  additionalData?: string;
  nonce: string;
  signatureType: SignatureConfig;
}

export async function verifySigAndGetNativeAddress({
  nonce,
  publicKey,
  signature,
  additionalData,
  signatureType,
}: VerifySignatureParams): Promise<string | false> {
  const data = additionalData ? additionalData + nonce : nonce;
  switch (signatureType) {
    case SignatureConfig.ARWEAVE:
      return (await verifyArweaveSignature({
        publicKey,
        signature,
        additionalData,
        nonce,
      }))
        ? arweaveRSAModulusToAddress(publicKey)
        : false;
    case SignatureConfig.ETHEREUM:
      return verifyEthereumSignature(publicKey, signature, data)
        ? computeAddress(publicKey)
        : false;
    default:
      return false;
  }
}

export async function verifyArweaveSignature({
  publicKey,
  signature,
  additionalData,
  nonce,
}: Omit<VerifySignatureParams, "signatureType">): Promise<boolean> {
  const dataToVerify = additionalData ? additionalData + nonce : nonce;
  const data = stringToBuffer(dataToVerify);
  const isVerified = await Arweave.crypto.verify(
    publicKey,
    data,
    fromB64UrlToBuffer(signature)
  );
  if (isVerified) {
    return isVerified;
  }

  // Fallback to subtle crypto verification for Browser signatures
  const hash = await crypto.subtle.digest("SHA-256", data);
  const publicJWK: JsonWebKey = {
    e: "AQAB",
    ext: true,
    kty: "RSA",
    n: publicKey,
  };

  // import public jwk for verification
  const verificationKey = await crypto.subtle.importKey(
    "jwk",
    publicJWK,
    {
      name: "RSA-PSS",
      hash: "SHA-256",
    },
    false,
    ["verify"]
  );

  // verify the signature by matching it with the hash
  const isValidSignature = await crypto.subtle.verify(
    { name: "RSA-PSS", saltLength: 32 },
    verificationKey,
    fromB64UrlToBuffer(signature),
    hash
  );
  return isValidSignature;
}

// TODO: SOLANA SIGNATURES
// export async function signSolanaData(
//   keypair: Keypair,
//   dataToSign: string
// ): Promise<Uint8Array> {
//   const signature = keypair.sign(stringToBuffer(dataToSign));
//   return signature;
// }

// export async function verifySolanaSignature(
//   publicKey: string,
//   signature: Uint8Array,
//   data: string
// ): boolean {
//   const key = new PublicKey(publicKey);
//   return key.verify(stringToBuffer(data), signature);}

// ETHEREUM SIGNATURES
export async function signEthereumData<W extends HDNodeWallet>(
  wallet: W,
  dataToSign: string
): Promise<string> {
  const sig = await wallet.signMessage(dataToSign);
  return toB64Url(Buffer.from(sig.slice(2), "hex"));
}

export function verifyEthereumSignature(
  publicKey: string,
  signature: string,
  data: string
): boolean {
  signature = fromB64UrlToBuffer(signature).toString("hex");
  signature = signature.startsWith("0x") ? signature : "0x" + signature;
  const recoveredAddress = verifyEthereumMessage(data, signature);
  const nativeAddress = computeAddress(publicKey);

  return recoveredAddress.toLowerCase() === nativeAddress.toLowerCase();
}

// KYVE (COSMOS) SIGNATURES TODO: Implement
