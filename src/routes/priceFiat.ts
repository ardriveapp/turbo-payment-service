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
import { PaymentValidationError, PromoCodeError } from "../database/errors";
import { KoaContext } from "../server";
import { Payment } from "../types/payment";
import { parseQueryParams } from "../utils/parseQueryParams";

export async function priceFiatHandler(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;
  const { pricingService } = ctx.state;
  const { destinationAddress: rawDestinationAddress, promoCode } = ctx.query;

  const promoCodes = parseQueryParams(promoCode);
  const [destinationAddress] = parseQueryParams(rawDestinationAddress);

  const walletAddress = destinationAddress || ctx.state.walletAddress;

  if (promoCodes.length > 0 && !walletAddress) {
    ctx.response.status = 400;
    ctx.body =
      "Promo codes must be applied to a specific `destinationAddress` or to the request signer";
    return next();
  }

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

  logger.debug("Payment Price GET Route :", {
    payment,
    walletAddress,
    promoCodes,
  });

  try {
    const wincForPaymentResponse = await pricingService.getWCForPayment({
      payment,
      promoCodes,
      userAddress: walletAddress,
    });

    const {
      actualPaymentAmount,
      adjustments,
      finalPrice,
      quotedPaymentAmount,
      inclusiveAdjustments,
    } = wincForPaymentResponse;

    logger.debug("Base credit amount found for payment", {
      payment,
      wincForPaymentResponse,
    });

    ctx.body = {
      winc: finalPrice.toString(),
      adjustments: adjustments.map((adjustment) => ({
        ...adjustment,
        catalogId: undefined,
      })),
      fees: inclusiveAdjustments.map((adjustment) => ({
        ...adjustment,
        catalogId: undefined,
      })),
      actualPaymentAmount,
      quotedPaymentAmount,
    };
    ctx.set("Cache-Control", `max-age=${oneMinuteInSeconds}`);
    ctx.response.status = 200;
  } catch (error) {
    if (error instanceof PromoCodeError) {
      logger.warn("Failed to get price with Promo Code:", {
        payment,
        message: error.message,
      });
      ctx.response.status = 400;
      ctx.body = error.message;
    } else {
      logger.error(
        "Failed to get price for payment!",
        { payment, error },
        error
      );
      ctx.response.status = 503;
      ctx.body = "Fiat Oracle Unavailable";
    }
  }

  return next();
}
