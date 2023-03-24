import crypto from "crypto";

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
  if (!signature || !publicKey || !nonce) {
    return false;
  }
  const dataToVerify = additionalData ? additionalData + nonce : nonce;
  try {
    const verifier = crypto.createVerify("SHA256");
    verifier.update(dataToVerify);

    const isVerified = verifier.verify(publicKey, signature);

    return isVerified;
  } catch (error) {
    return false;
  }
}
