import { createSign, createVerify } from "crypto";

export const verifySignedRequest = async (
  publicKey: string,
  data: Uint8Array,
  nonce: string,
  signature: string
) => {
  const verifier = createVerify("RSA-SHA256");
  verifier.update(data + nonce);
  return verifier.verify(publicKey, signature, "base64");
};

export const signRequest = async (
  privateKey: string,
  data: Uint8Array,
  nonce: string
) => {
  const signer = createSign("RSA-SHA256");
  signer.update(data + nonce);
  return signer.sign(privateKey, "base64");
};
