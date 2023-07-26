/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
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
import { Next } from "koa";

import { InsufficientBalance, UserNotFoundWarning } from "../database/errors";
import { KoaContext } from "../server";
import { ByteCount } from "../types";

export async function reserveBalance(ctx: KoaContext, next: Next) {
  const { paymentDatabase, pricingService, logger } = ctx.state;
  const { walletAddress } = ctx.params;
  // TODO: do some regex validation on the dataItemId
  const { byteCount: rawByteCount, dataItemId } = ctx.query;

  if (!ctx.request.headers.authorization || !ctx.state.user) {
    ctx.response.status = 401;
    ctx.body = "Unauthorized";
    logger.error(
      "Unable to reserve balance. No authorization or user provided.",
      {
        user: ctx.state.user,
        headers: ctx.request.headers,
      }
    );
    return next();
  }

  // validate we have what we need
  if (
    // TODO: once the new service is converted, validate dataItemId exists here
    Array.isArray(dataItemId) ||
    !rawByteCount ||
    Array.isArray(rawByteCount)
  ) {
    ctx.response.status = 400;
    ctx.body = "Missing parameters";
    logger.error("GET Reserve balance route with missing parameters!", {
      ...ctx.params,
      ...ctx.query,
    });
    return next();
  }

  let byteCount: ByteCount;
  try {
    byteCount = ByteCount(+rawByteCount);
  } catch (error) {
    ctx.response.status = 400;
    ctx.body = `Invalid parameter for byteCount: ${rawByteCount}`;
    logger.error("GET Reserve balance route with invalid parameters!", {
      ...ctx.params,
      ...ctx.query,
    });
    return next();
  }

  try {
    logger.info("Getting base credit amount for byte count...", {
      walletAddress,
      byteCount,
      dataItemId,
    });
    const priceWithAdjustments = await pricingService.getWCForBytes(byteCount);

    logger.info("Reserving balance for user ", {
      walletAddress,
      byteCount,
      dataItemId,
      ...priceWithAdjustments,
    });
    await paymentDatabase.reserveBalance(
      walletAddress,
      priceWithAdjustments.winc,
      dataItemId
    );
    ctx.response.status = 200;
    ctx.response.message = "Balance reserved";
    // TODO: add subsidy amounts to this response
    ctx.response.body = priceWithAdjustments.winc;
    logger.info("Balance reserved for user!", {
      walletAddress,
      byteCount,
      dataItemId,
      ...priceWithAdjustments,
    });

    return next();
  } catch (error: UserNotFoundWarning | InsufficientBalance | unknown) {
    if (error instanceof UserNotFoundWarning) {
      ctx.response.status = 404;
      ctx.response.message = "User not found";
      logger.info(error.message, { walletAddress, byteCount });
    } else if (error instanceof InsufficientBalance) {
      ctx.response.status = 402;
      ctx.response.message = "Insufficient balance";
      logger.info(error.message, { walletAddress, byteCount });
      return next();
    } else {
      logger.error("Error reserving balance", {
        walletAddress,
        byteCount,
        error,
      });

      ctx.response.status = 502;
      ctx.response.message = "Error reserving balance";
    }
  }
  return next();
}
