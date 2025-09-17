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
import { KoaContext } from "../server";

export async function balanceRoute(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;
  const { paymentDatabase } = ctx.state;

  const walletAddress = ctx.state.walletAddress ?? ctx.request.query.address;

  if (!walletAddress) {
    ctx.status = 403;
    ctx.body = "Invalid signature or missing required headers";
    return next();
  }

  logger.debug("Balance requested", { walletAddress });

  try {
    const {
      effectiveBalance,
      givenApprovals,
      receivedApprovals,
      controlledWinc,
      winc: balance,
    } = await paymentDatabase.getBalance(walletAddress);

    ctx.body = {
      winc: balance.toString(),
      // For compatibility with the existing ecosystem APIs
      balance: balance.toString(),
      controlledWinc: controlledWinc.toString(),
      effectiveBalance: effectiveBalance.toString(),
      givenApprovals,
      receivedApprovals,
    };
    logger.debug("Balance found!", { balance, walletAddress });
  } catch (error) {
    if (error instanceof UserNotFoundWarning) {
      logger.debug(error.message);
      ctx.response.status = 404;
      ctx.body = "User Not Found";
    } else {
      logger.error(error);
      ctx.response.status = 503;
      ctx.body = "Cloud Database Unavailable";
    }
  }

  return next();
}
