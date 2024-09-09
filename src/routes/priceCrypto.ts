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

import { oneMinuteInSeconds } from "../constants";
import { BadRequest } from "../database/errors";
import { KoaContext } from "../server";
import { W } from "../types";

export async function priceCryptoHandler(ctx: KoaContext, next: Next) {
  const { pricingService, logger } = ctx.state;
  const { amount, currency: token } = ctx.params;

  // TODO: Allow promo codes on crypto payments
  // const { destinationAddress: rawDestinationAddress /*promoCode*/ } = ctx.query;
  // const promoCodes = parseQueryParams(promoCode);

  try {
    if (!amount || !token) {
      throw new BadRequest("Missing required parameters");
    }

    const wincForPaymentResponse = await pricingService.getWCForCryptoPayment({
      amount: W(amount),
      token,
    });

    const { actualPaymentAmount, finalPrice, inclusiveAdjustments } =
      wincForPaymentResponse;

    ctx.body = {
      winc: finalPrice.toString(),
      fees: inclusiveAdjustments.map((adjustment) => ({
        ...adjustment,
        catalogId: undefined,
      })),
      actualPaymentAmount,
    };
    ctx.set("Cache-Control", `max-age=${oneMinuteInSeconds}`);
    ctx.response.status = 200;
  } catch (error) {
    if (error instanceof BadRequest) {
      ctx.response.status = 400;
      ctx.body = error.message;
    } else {
      logger.error(
        "Failed to get price for crypto payment!",
        { amount, token, error },
        error
      );
      ctx.response.status = 503;
      ctx.body = "Fiat Oracle Unavailable";
    }
  }

  return next();
}
