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
