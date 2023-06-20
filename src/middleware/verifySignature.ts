import jwt from "jsonwebtoken";
import { Context, Next } from "koa";
import winston from "winston";

import { fromB64UrlToBuffer } from "../utils/base64";
import { publicKeyToAddress } from "../utils/jwkUtils";
import { verifyArweaveSignature } from "../utils/verifyArweaveSignature";

// You should use a secure and secret key for JWT token generation
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export async function verifySignature(ctx: Context, next: Next): Promise<void> {
  const signature = ctx.request.headers["x-signature"] as string;
  const publicKey = ctx.request.headers["x-public-key"] as string;
  const nonce = ctx.request.headers["x-nonce"] as string;
  const logger = (ctx.state.logger as winston.Logger).child({
    signature,
    publicKey,
    nonce,
  });

  try {
    if (!signature || !publicKey || !nonce) {
      logger.info("Missing signature, public key or nonce");
      return next();
    }
    logger.info("Verifying arweave signature");

    const isVerified = await verifyArweaveSignature({
      publicKey,
      signature: fromB64UrlToBuffer(signature),
      additionalData: Object.keys(ctx.request.query).length
        ? JSON.stringify(ctx.request.query)
        : undefined,
      nonce: nonce,
    });

    logger.info(
      `Signature verification ${isVerified ? "succeeded" : "failed"}.`
    );
    if (isVerified) {
      // Attach wallet address for the next middleware
      ctx.state.walletAddress = await publicKeyToAddress(publicKey);
      // Generate a JWT token for subsequent requests
      logger.info("Generating JWT token for wallet.", {
        wallet: ctx.state.walletAddress,
      });
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
