import crypto, { KeyLike } from "crypto";

export async function signData(
  privateKey: KeyLike,
  dataToSign: string
): Promise<Uint8Array> {
  const pem = (privateKey as unknown as crypto.KeyObject).export({
    format: "pem",
    type: "pkcs1",
  });
  const sign = crypto.createSign("sha256");
  sign.update(dataToSign);

  const signature = sign.sign({
    key: pem,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: 0, // We do not need to salt the signature since we combine with a random UUID
  });
  return Promise.resolve(signature);
}
