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

export async function getArNSPurchaseStatus(ctx: KoaContext, next: Next) {
  const { paymentDatabase, logger } = ctx.state;

  const nonce = ctx.params.nonce;

  try {
    if (!nonce) {
      throw new BadRequest("Nonce is required");
    }

    const purchaseStatus = await paymentDatabase.getArNSPurchaseStatus(nonce);

    if (!purchaseStatus) {
      throw new BadRequest("Purchase status not found");
    }
    ctx.response.status = 200;
    ctx.response.message = "Purchase status retrieved successfully";

    ctx.body = purchaseStatus;
  } catch (error) {
    if (error instanceof BadRequest) {
      ctx.response.status = 400;
      ctx.body = error.message;
    } else {
      logger.error("Error retrieving purchase status", error, {
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
