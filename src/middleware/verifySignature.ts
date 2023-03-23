import Arweave from "arweave";
import crypto from "crypto";
import { Context, Next } from "koa";

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

  const verifier = crypto.createVerify("SHA256");
  verifier.update(dataToVerify);

  const isVerified = verifier.verify(publicKey, signature);

  return isVerified;
}

export async function verifySignature(ctx: Context, next: Next): Promise<void> {
  try {
    const signature = ctx.request.headers["x-signature"];
    const publicKey = ctx.request.headers["x-public-key"];
    const nonce = ctx.request.headers["x-nonce"];

    const isVerified = await verifyArweaveSignature({
      publicKey: publicKey as string,
      signature: Arweave.utils.stringToBuffer(signature as string),
      additionalData: Object.keys(ctx.request.query).length
        ? JSON.stringify(ctx.request.query)
        : undefined,
      nonce: nonce as string,
    });

    if (isVerified) {
      ctx.state.walletAddress = ctx.request.headers["x-public-key"];
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
