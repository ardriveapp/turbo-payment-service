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
import { getValidatedReserveBalanceParams } from "../utils/validators";

export async function reserveBalance(ctx: KoaContext, next: Next) {
  const { paymentDatabase, pricingService, logger } = ctx.state;

  try {
    const {
      byteCount,
      dataItemId,
      paidBy,
      paymentDirective,
      signerAddress,
      signerAddressType,
    } = getValidatedReserveBalanceParams(ctx);
    const priceWithAdjustments = await pricingService.getWCForBytes(
      byteCount,
      // If paidBy is not provided, use the signer address as the payer
      paidBy.length > 0 ? paidBy[0] : signerAddress
    );
    const {
      finalPrice,
      networkPrice,
      adjustments,
      deprecatedChunkBasedNetworkPrice,
    } = priceWithAdjustments;

    await paymentDatabase.reserveBalance({
      signerAddress,
      dataItemId,
      reservedWincAmount: finalPrice,
      adjustments,
      networkWincAmount: networkPrice,
      signerAddressType,
      paidBy,
      paymentDirective,
    });

    ctx.response.status = 200;
    ctx.response.message = "Balance reserved";
    ctx.body = finalPrice.winc;

    logger.info("Balance reserved for user!", {
      signerAddress,
      byteCount,
      dataItemId,
      networkPrice: networkPrice.winc,
      networkPriceDifference: networkPrice.winc.minus(
        deprecatedChunkBasedNetworkPrice.winc
      ),
    });
  } catch (error: UserNotFoundWarning | InsufficientBalance | unknown) {
    if (error instanceof UserNotFoundWarning) {
      ctx.response.status = 404;
      ctx.response.message = "User not found";
    } else if (error instanceof InsufficientBalance) {
      ctx.response.status = 402;
      ctx.response.message = "Insufficient balance";
    } else if (error instanceof Unauthorized) {
      ctx.response.status = 401;
      ctx.response.message = error.message;
    } else if (error instanceof BadRequest) {
      logger.error("Bad request reserving balance", {
        params: ctx.params,
        query: ctx.query,
        error,
      });
      ctx.response.status = 400;
      ctx.response.message = error.message;
    } else {
      logger.error("Error reserving balance", {
        params: ctx.params,
        query: ctx.query,
        error,
      });

      ctx.response.status = 503;
      ctx.response.message = "Error reserving balance";
    }
  }

  return next();
}
