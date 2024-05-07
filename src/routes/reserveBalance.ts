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
import { Next } from "koa";

import { InsufficientBalance, UserNotFoundWarning } from "../database/errors";
import { KoaContext } from "../server";
import { isValidUserAddress } from "../utils/base64";
import {
  validateAuthorizedRoute,
  validateByteCount,
  validateQueryParameters,
  validateUserAddressType,
} from "../utils/validators";

export async function reserveBalance(ctx: KoaContext, next: Next) {
  const { paymentDatabase, pricingService, logger } = ctx.state;

  const { walletAddress, token: rawToken = "arweave" } = ctx.params;

  if (!validateAuthorizedRoute(ctx)) {
    return next();
  }

  const { byteCount: rawByteCount, dataItemId: rawDataItemId } = ctx.query;

  const userAddressType = validateUserAddressType(ctx, rawToken);
  if (!userAddressType) {
    return next();
  }
  if (!isValidUserAddress(walletAddress, userAddressType)) {
    ctx.response.status = 400;
    ctx.response.message = "Invalid wallet address";
    return next();
  }

  const queryParameters = [rawByteCount, rawDataItemId];
  if (!validateQueryParameters(ctx, queryParameters)) {
    return next();
  }

  // TODO: do some regex validation on the dataItemId
  const [stringByteCount, dataItemId] = queryParameters;

  const byteCount = validateByteCount(ctx, stringByteCount);
  if (!byteCount) {
    return next();
  }

  try {
    logger.info("Getting base credit amount for byte count...", {
      walletAddress,
      byteCount,
      dataItemId,
    });
    const priceWithAdjustments = await pricingService.getWCForBytes(
      byteCount,
      walletAddress
    );
    const { finalPrice, networkPrice, adjustments } = priceWithAdjustments;

    logger.info("Reserving balance for user ", {
      walletAddress,
      byteCount,
      dataItemId,
      ...priceWithAdjustments,
    });
    await paymentDatabase.reserveBalance({
      userAddress: walletAddress,
      dataItemId,
      reservedWincAmount: finalPrice,
      adjustments,
      networkWincAmount: networkPrice,
      userAddressType,
    });
    ctx.response.status = 200;
    ctx.response.message = "Balance reserved";
    // TODO: Adjust to JSON response body to Expose adjustments via Reserve balance (e.g: body = { winc, adjustments }), and then to the user of data POST
    ctx.body = finalPrice.winc;
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
