import Arweave from "arweave";
import crypto, { createHash } from "crypto";
import { Context, Next } from "koa";

import { formatPublicKey } from "../utils/pem";

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
  let dataToVerify: string;

  if (additionalData) {
    dataToVerify = additionalData + nonce;
  } else {
    dataToVerify = nonce;
  }
  try {
    const verifier = crypto.createVerify("SHA256");
    verifier.update(dataToVerify);

    const isVerified = verifier.verify(publicKey, signature);

    return isVerified;
  } catch (error) {
    return false;
  }
}

export async function verifySignature(ctx: Context, next: Next): Promise<void> {
  try {
    const signature = ctx.request.headers["x-signature"];
    const publicKey = ctx.request.headers["x-public-key"];
    const nonce = ctx.request.headers["x-nonce"];

    const isVerified = await verifyArweaveSignature({
      publicKey: formatPublicKey(publicKey as string),
      signature: Arweave.utils.b64UrlToBuffer(signature as string),
      additionalData: Object.keys(ctx.request.query).length
        ? JSON.stringify(ctx.request.query)
        : undefined,
      nonce: nonce as string,
    });
    if (isVerified) {
      //Attach wallet address for the next middleware
      const hash = createHash("sha256");
      hash.update(Arweave.utils.b64UrlToBuffer(publicKey as string));
      const buffer = hash.digest();
      const walletAddress = Arweave.utils.bufferTob64(buffer);
      ctx.state.walletAddress = walletAddress;
      await next();
    } else {
      ctx.status = isVerified ? 0 : 403;
      ctx.body = isVerified
        ? ""
        : "Invalid signature or missing required headers";
    }
  } catch (error) {
    console.error(error);
    ctx.status = 500;
    ctx.body = "Internal Server Error";
  }
}
