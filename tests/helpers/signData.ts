import Arweave from "arweave/node/common";
import { stringToBuffer } from "arweave/node/lib/utils";
import { AxiosRequestHeaders } from "axios";
import { Buffer } from "buffer";
import { randomUUID } from "crypto";

import { JWKInterface } from "../../src/types/jwkTypes";
import { toB64Url } from "../../src/utils/base64";

export async function signData(
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
): Promise<AxiosRequestHeaders> {
  const signature = await signData(jwk, data + nonce);

  return {
    "x-public-key": jwk.n,
    "x-nonce": nonce,
    "x-signature": toB64Url(Buffer.from(signature)),
  };
}
