import jwt from "jsonwebtoken";
import { Context, Next } from "koa";

import logger from "../logger";
import { fromB64UrlToBuffer } from "../utils/base64";
import { publicPemToArweaveAddress } from "../utils/pem";
import { verifyArweaveSignature } from "../utils/verifyArweaveSignature";

// You should use a secure and secret key for JWT token generation
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export async function verifySignature(ctx: Context, next: Next): Promise<void> {
  try {
    const signature = ctx.request.headers["x-signature"];
    const publicKey = ctx.request.headers["x-public-key"] as string;
    const nonce = ctx.request.headers["x-nonce"];
    if (!signature || !publicKey || !nonce) {
      logger.info("Missing signature, public key or nonce");
      return next();
    }
    const publicPem = fromB64UrlToBuffer(publicKey).toString();
    const isVerified = await verifyArweaveSignature({
      publicPem: publicPem,
      signature: fromB64UrlToBuffer(signature as string),
      additionalData: Object.keys(ctx.request.query).length
        ? JSON.stringify(ctx.request.query)
        : undefined,
      nonce: nonce as string,
    });
    if (isVerified) {
      // Attach wallet address for the next middleware
      ctx.state.walletAddress = await publicPemToArweaveAddress(publicPem);
      // Generate a JWT token for subsequent requests
      const token = jwt.sign(
        { walletAddress: ctx.state.walletAddress },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      ctx.set("Authorization", `Bearer ${token}`);

    }
  } catch (error) {
    logger.error(error);
  }
  return next();
}
