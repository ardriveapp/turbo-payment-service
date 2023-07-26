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

import { UserNotFoundWarning } from "../database/errors";
import { KoaContext } from "../server";
import { Winston } from "../types/winston";

export async function refundBalance(ctx: KoaContext, next: Next) {
  const { paymentDatabase, logger } = ctx.state;
  const { walletAddress } = ctx.params;

  const { winstonCredits, dataItemId } = ctx.query;

  if (!ctx.request.headers.authorization || !ctx.state.user) {
    ctx.response.status = 401;
    ctx.body = "Unauthorized";
    logger.error("GET Refund balance route with no AUTHORIZATION!");
    return next();
  }

  if (
    Array.isArray(dataItemId) ||
    !winstonCredits ||
    Array.isArray(winstonCredits)
  ) {
    ctx.response.status = 400;
    ctx.body = "Invalid parameters";
    logger.error("GET Refund balance route with invalid parameters!", {
      query: ctx.query,
      params: ctx.params,
    });
    return next();
  }

  let winstonCreditsToRefund: Winston;
  try {
    winstonCreditsToRefund = new Winston(+winstonCredits);
  } catch (error) {
    ctx.response.status = 400;
    ctx.body = `Invalid value provided for winstonCredits: ${winstonCredits}`;
    return next();
  }

  logger.info("Refunding balance for user ", {
    walletAddress,
    winstonCreditsToRefund,
    dataItemId,
  });
  try {
    await paymentDatabase.refundBalance(
      walletAddress,
      winstonCreditsToRefund,
      dataItemId
    );
    ctx.response.status = 200;
    ctx.response.message = "Balance refunded";
    logger.info("Balance refund processed", {
      walletAddress,
      winstonCreditsToRefund,
      dataItemId,
    });
  } catch (error: UserNotFoundWarning | unknown) {
    if (error instanceof UserNotFoundWarning) {
      ctx.response.status = 404;
      ctx.response.message = "User not found";
      logger.info(error.message, {
        walletAddress,
        winstonCreditsToRefund,
      });
    } else {
      ctx.response.status = 502;
      ctx.response.message = "Error refunding balance";
      logger.error("Error refunding balance", {
        walletAddress,
        winstonCreditsToRefund,
        error,
      });
    }
  }
  return next();
}
