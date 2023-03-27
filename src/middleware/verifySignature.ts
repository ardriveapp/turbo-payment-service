import { createHash } from "crypto";
import { Context, Next } from "koa";

import logger from "../logger";
import { fromB64UrlToBuffer, toB64Url } from "../utils/base64";
import { verifyArweaveSignature } from "../utils/verifyArweaveSignature";

export async function verifySignature(ctx: Context, next: Next): Promise<void> {
  try {
    const signature = ctx.request.headers["x-signature"];
    const publicKey = ctx.request.headers["x-public-key"] as string;
    const nonce = ctx.request.headers["x-nonce"];

    if (!signature || !publicKey || !nonce) {
      logger.info("Missing signature, public key or nonce");
      return next();
    }

    const isVerified = await verifyArweaveSignature({
      publicKey: fromB64UrlToBuffer(publicKey).toString(),
      signature: fromB64UrlToBuffer(signature as string),
      additionalData: Object.keys(ctx.request.query).length
        ? JSON.stringify(ctx.request.query)
        : undefined,
      nonce: nonce as string,
    });
    if (isVerified) {
      //Attach wallet address for the next middleware
      const hash = createHash("sha256");
      hash.update(fromB64UrlToBuffer(publicKey as string));
      const buffer = hash.digest();
      const walletAddress = toB64Url(buffer);
      ctx.state.walletAddress = walletAddress;
      await next();
    }
  } catch (error) {
    logger.error(error);
  }
  return next();
}
