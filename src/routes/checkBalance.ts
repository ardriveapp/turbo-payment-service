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

import { UserNotFoundWarning } from "../database/errors";
import { WincForBytesResponse } from "../pricing/pricing";
import { KoaContext } from "../server";
import { W, Winston } from "../types";
import {
  validateAuthorizedRoute,
  validateByteCount,
  validateQueryParameters,
} from "../utils/validators";

export async function checkBalance(ctx: KoaContext, next: Next) {
  const { paymentDatabase, pricingService, logger } = ctx.state;
  const { walletAddress }: { walletAddress: string } = ctx.params;

  if (validateAuthorizedRoute(ctx) === false) {
    return next();
  }

  const { byteCount: rawByteCount } = ctx.query;
  const queryParameters = [rawByteCount];
  if (!validateQueryParameters(ctx, queryParameters)) {
    return next();
  }

  const [stringByteCount] = queryParameters;

  const byteCount = validateByteCount(ctx, stringByteCount);
  if (!byteCount) {
    return next();
  }

  let priceWithAdjustments: WincForBytesResponse;
  try {
    logger.info("Getting base credit amount for byte count...", {
      walletAddress,
      byteCount,
    });
    priceWithAdjustments = await pricingService.getWCForBytes(
      byteCount,
      walletAddress
    );
  } catch (error) {
    ctx.response.status = 503;
    ctx.body = "Error getting base credit amount";
    logger.error("Error getting base credit amount", {
      walletAddress,
      byteCount,
      error,
    });
    return next();
  }
  const { finalPrice, adjustments } = priceWithAdjustments;

  try {
    let userBalance: Winston = W("0");
    // If price is more than 0, check if user has sufficient balance
    if (finalPrice.winc.isNonZeroPositiveInteger() === true) {
      userBalance = await paymentDatabase.getBalance(walletAddress);

      if (finalPrice.winc.isGreaterThan(userBalance)) {
        ctx.response.status = 402;
        ctx.response.message = "Insufficient balance";
        ctx.body = {
          userHasSufficientBalance: false,
          bytesCostInWinc: finalPrice.winc.toString(),
          userBalanceInWinc: userBalance.toString(),
          adjustments: adjustments,
        };
        return next();
      }
    }

    ctx.response.status = 200;
    ctx.response.message = "User has sufficient balance";
    ctx.body = {
      userHasSufficientBalance: true,
      bytesCostInWinc: finalPrice.winc.toString(),
      adjustments: adjustments,
      userBalanceInWinc: userBalance.toString(),
    };
  } catch (error: UserNotFoundWarning | unknown) {
    if (error instanceof UserNotFoundWarning) {
      ctx.response.status = 404;
      ctx.response.message = "User not found";
      ctx.body = {
        userHasSufficientBalance: false,
        bytesCostInWinc: finalPrice.winc.toString(),
        userBalanceInWinc: "0",
        adjustments: adjustments,
      };
      logger.info(error.message, { walletAddress, byteCount });
    } else {
      logger.error("Error checking balance", {
        walletAddress,
        byteCount,
        error,
      });

      ctx.response.status = 503;
      ctx.body = "Error checking balance";
    }
  }

  return next();
}
