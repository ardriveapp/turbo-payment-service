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

import { BadRequest } from "../database/errors";
import { KoaContext } from "../server";
import { remainingWincAmountFromApprovals } from "../utils/common";
import { getValidatedGetApprovalParams } from "../utils/validators";

export async function getApprovals(ctx: KoaContext, next: Next) {
  const { paymentDatabase, logger } = ctx.state;

  try {
    const { approvedAddress, payingAddress } =
      getValidatedGetApprovalParams(ctx);

    const approvals = await paymentDatabase.getApprovalsFromPayerForAddress({
      approvedAddress,
      payingAddress,
    });
    ctx.response.status = 200;
    ctx.response.message = "Approvals retrieved";

    ctx.body = {
      approvals,
      // For previous software compatibility, return an amount and the earliest expiration date
      amount: remainingWincAmountFromApprovals(approvals).toString(),
      expiresBy: approvals[0].expirationDate
        ? new Date(approvals[0].expirationDate).getTime()
        : undefined,
    };
  } catch (error) {
    if (error instanceof BadRequest) {
      ctx.response.status = 400;
      ctx.body = error.message;
    } else {
      logger.error("Error getting approvals", error, {
        query: ctx.query,
        params: ctx.params,
      });
      ctx.response.status = 503;
      ctx.body = error instanceof Error ? error.message : error;
    }
  }

  return next();
}
