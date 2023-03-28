import crypto from "crypto";

export interface VerifySignatureParams {
  publicPem: string;
  signature: Uint8Array;
  additionalData?: string;
  nonce: string;
}

export async function verifyArweaveSignature({
  publicPem,
  signature,
  additionalData,
  nonce,
}: VerifySignatureParams): Promise<boolean> {
  const dataToVerify = additionalData ? additionalData + nonce : nonce;
  try {
    const verifier = crypto.createVerify("SHA256");
    verifier.update(dataToVerify);

    const isVerified = verifier.verify(publicPem, signature);

    return isVerified;
  } catch (error) {
    return false;
  }
}
