/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import jwt from "jsonwebtoken";
import { Context, Next } from "koa";
import winston from "winston";

import { fromB64UrlToBuffer } from "../utils/base64";
import { arweaveRSAModulusToAddress } from "../utils/jwkUtils";
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
      logger.debug("Missing signature, public key or nonce");
      return next();
    }
    logger.info("Verifying arweave signature");

    // TODO: use a factory that verifies, validates and returns address of provided x-public-key-header
    const isVerified = await verifyArweaveSignature({
      publicKey,
      signature: fromB64UrlToBuffer(signature),
      // TODO: Verify from additional DATA on POST
      additionalData: undefined,
      nonce: nonce,
    });

    logger.info("Signature verification result computed.", { isVerified });

    if (isVerified) {
      // Attach wallet address for the next middleware
      ctx.state.walletAddress = arweaveRSAModulusToAddress(publicKey);
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

export async function addressFromQuery(
  ctx: Context,
  next: Next
): Promise<void> {
  const address = (ctx.request.query["address"] as string) || "";

  if (!address) {
    ctx.status = 400;
    ctx.body = "Missing address in query parameters";
    return;
  }

  ctx.state.walletAddress = address;
  return next();
}
