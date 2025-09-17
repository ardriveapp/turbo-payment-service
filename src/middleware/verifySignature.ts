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
import { SignatureConfig } from "@dha-team/arbundles";
import jwt from "jsonwebtoken";
import { Context, Next } from "koa";
import winston from "winston";

import { verifySigAndGetNativeAddress } from "../utils/verifyArweaveSignature";

// You should use a secure and secret key for JWT token generation
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export async function verifySignature(ctx: Context, next: Next): Promise<void> {
  const signature = ctx.request.headers["x-signature"] as string;
  const rawSigType = ctx.request.headers["x-signature-type"] as
    | string
    | undefined;
  const publicKey = ctx.request.headers["x-public-key"] as string;
  const nonce = ctx.request.headers["x-nonce"] as string;
  const logger = (ctx.state.logger as winston.Logger).child({
    signature,
    publicKey,
    nonce,
  });

  try {
    let signatureType: number;
    if (rawSigType) {
      signatureType = +rawSigType;
      if (isNaN(signatureType)) {
        logger.debug("Invalid signature type", { rawSigType });
        return next();
      }
    } else {
      signatureType = SignatureConfig.ARWEAVE;
    }

    const supportedSignatureTypes: SignatureConfig[] = [
      SignatureConfig.ARWEAVE,
      SignatureConfig.ETHEREUM,
    ];
    if (
      !signature ||
      !publicKey ||
      !nonce ||
      supportedSignatureTypes.indexOf(signatureType as SignatureConfig) === -1
    ) {
      logger.debug(
        "Missing signature, public key, nonce, or unsupported token.",
        {
          signature: !!signature,
          publicKey: !!publicKey,
          nonce: !!nonce,
          signatureType,
          supportedSignatureTypes,
        }
      );
      return next();
    }

    const maybeWalletAddress = await verifySigAndGetNativeAddress({
      signatureType,
      publicKey,
      signature,
      // TODO: Verify from additional DATA on POST
      additionalData: undefined,
      nonce: nonce,
    });

    const isVerified = maybeWalletAddress !== false;

    logger.debug("Signature verification result computed.", {
      isVerified,
      maybeWalletAddress,
    });

    if (isVerified) {
      // Attach wallet address for the next middleware
      ctx.state.walletAddress = maybeWalletAddress;
      ctx.state.nonce = nonce;
      // Generate a JWT token for subsequent requests
      logger.debug("Generating JWT token for wallet.", {
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
