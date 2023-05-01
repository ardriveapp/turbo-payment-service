import crypto, { KeyObject } from "crypto";

export interface VerifySignatureParams {
  publicKey: KeyObject;
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
  try {
    const pem = (publicKey as unknown as crypto.KeyObject).export({
      format: "pem",
      type: "pkcs1",
    });
    const verifier = crypto.createVerify("sha256");
    verifier.update(dataToVerify);

    const isVerified = verifier.verify(
      {
        key: pem,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: 0,
      },
      signature
    );

    return isVerified;
  } catch (error) {
    return false;
  }
}
