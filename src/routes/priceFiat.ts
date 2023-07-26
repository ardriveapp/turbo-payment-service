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

import { oneMinuteInSeconds } from "../constants";
import { PaymentValidationError } from "../database/errors";
import { KoaContext } from "../server";
import { Payment } from "../types/payment";

export async function priceFiatHandler(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;
  const { pricingService } = ctx.state;

  let payment: Payment;
  try {
    payment = new Payment({
      amount: ctx.params.amount,
      type: ctx.params.currency,
    });
  } catch (error) {
    ctx.response.status = 400;
    ctx.body = (error as PaymentValidationError).message;
    return next();
  }
  logger.info("Payment Price GET Route :", { payment });

  try {
    const winstonCreditAmount = await pricingService.getWCForPayment(payment);

    logger.info("Base credit amount found for payment", {
      payment,
      winstonCreditAmount,
    });

    ctx.body = { winc: winstonCreditAmount.toString() };
    ctx.set("Cache-Control", `max-age=${oneMinuteInSeconds}`);
    ctx.response.status = 200;
  } catch (error) {
    logger.error("Failed to get price for payment!", { payment }, error);
    ctx.response.status = 502;
    ctx.body = "Fiat Oracle Unavailable";
  }

  return next();
}
