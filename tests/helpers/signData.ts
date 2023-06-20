import { AxiosRequestHeaders } from "axios";
import { Buffer } from "buffer";
import crypto, { KeyLike, randomUUID } from "crypto";

import {
  JWKInterface,
  jwkInterfaceToPrivateKey,
} from "../../src/types/jwkTypes";
import { toB64Url } from "../../src/utils/base64";

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

export async function signedRequestHeadersFromJwk(
  jwk: JWKInterface,
  nonce: string = randomUUID(),
  data = ""
): Promise<AxiosRequestHeaders> {
  const signature = await signData(jwkInterfaceToPrivateKey(jwk), data + nonce);

  return {
    "x-public-key": jwk.n,
    "x-nonce": nonce,
    "x-signature": toB64Url(Buffer.from(signature)),
  };
}
