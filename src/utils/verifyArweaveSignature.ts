import Arweave from "arweave/node/common.js";
import { stringToBuffer } from "arweave/node/lib/utils.js";

export interface VerifySignatureParams {
  publicKey: string;
  signature: Uint8Array;
  additionalData?: string;
  nonce: string;
}

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
