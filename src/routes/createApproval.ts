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

import {
  BadRequest,
  InsufficientBalance,
  Unauthorized,
  UserNotFoundWarning,
} from "../database/errors";
import { KoaContext } from "../server";
import {
  assertAuthorizedRoute,
  getValidatedCreateApprovalParams,
} from "../utils/validators";

export async function createApproval(ctx: KoaContext, next: Next) {
  const { paymentDatabase, logger } = ctx.state;

  try {
    assertAuthorizedRoute(ctx);

    const approval = await paymentDatabase.createDelegatedPaymentApproval(
      getValidatedCreateApprovalParams(ctx)
    );
    ctx.response.status = 200;
    ctx.response.message = "Approval created";

    ctx.body = approval;
  } catch (error) {
    if (error instanceof BadRequest) {
      ctx.response.status = 400;
      ctx.body = error.message;
    } else if (error instanceof Unauthorized) {
      ctx.response.status = 401;
      ctx.body = error.message;
    } else if (
      error instanceof InsufficientBalance ||
      error instanceof UserNotFoundWarning
    ) {
      ctx.response.status = 402;
      ctx.body = error.message;
    } else {
      logger.error("Error creating approval", error, {
        query: ctx.query,
        params: ctx.params,
      });
      ctx.response.status = 503;
      ctx.body =
        error instanceof Error ? error.message : "Internal server error";
    }
  }

  return next();
}
