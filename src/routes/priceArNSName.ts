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

import { oneMinuteInSeconds, paymentAmountLimits } from "../constants";
import { BadRequest } from "../database/errors";
import { KoaContext } from "../server";
import { W } from "../types";
import { Payment } from "../types/payment";
import { parseQueryParams } from "../utils/parseQueryParams";
import { getValidatedArNSPriceParams } from "../utils/validators";

export async function priceArNSPurchaseHandler(ctx: KoaContext, next: Next) {
  const { pricingService, logger, gatewayMap } = ctx.state;
  const { ario } = gatewayMap;

  try {
    const { intent, name, increaseQty, type, years, currency, userAddress } =
      getValidatedArNSPriceParams(ctx);

    const mARIOQty = await ario.getTokenCost({
      name,
      intent,
      type,
      increaseQty,
      years,
    });

    const wincForPaymentResponse = await pricingService.getWCForCryptoPayment({
      amount: W(mARIOQty.valueOf()),
      token: "ario",
      feeMode: "none",
    });

    const { finalPrice } = wincForPaymentResponse;

    const body: Record<string, unknown> = {
      mARIO: mARIOQty.toString(),
      winc: finalPrice.toString(),
    };

    // If user provides a valid fiat currency type in query params, we will also give a
    // fiat quote estimate for the payment. This has no expiration time and is not honored
    if (currency) {
      const { finalPrice, inclusiveAdjustments } =
        await pricingService.getWCForCryptoPayment({
          amount: W(mARIOQty.valueOf()),
          token: "ario",
          // Add infra fee to the price, not take it out
          feeMode: "invert",
        });
      const promoCodes = parseQueryParams(ctx.query.promoCode);

      const price = await pricingService.getFiatPriceForCryptoAmount({
        amount: finalPrice.valueOf(),
        token: "arweave",
        type: currency,
        promoCodes,
        userAddress,
      });
      const { quotedPaymentAmount, adjustments } = price;

      let excessWincAmount = W(0);
      let { paymentAmount } = price;

      const stripeMinimumPaymentAmount =
        paymentAmountLimits[currency].stripeMinimumPaymentAmount;
      if (paymentAmount < stripeMinimumPaymentAmount) {
        const excessPaymentAmount = stripeMinimumPaymentAmount - paymentAmount;
        paymentAmount = stripeMinimumPaymentAmount;

        excessWincAmount = (
          await pricingService.getWCForPayment({
            payment: new Payment({
              amount: excessPaymentAmount,
              type: currency,
            }),
            promoCodes: [],
          })
        ).finalPrice.winc;
      }

      const payment = new Payment({
        amount: paymentAmount,
        type: currency,
      });

      const fiatEstimate: Record<string, unknown> = {
        paymentAmount: payment.amount,
        quotedPaymentAmount: quotedPaymentAmount.toString(),
      };

      if (!excessWincAmount.isZero()) {
        fiatEstimate.excessWincAmount = excessWincAmount.toString();
      }
      if (adjustments.length > 0) {
        fiatEstimate.adjustments = adjustments.map(
          ({ catalogId: _, ...adjustmentsWithoutCatalogId }) =>
            adjustmentsWithoutCatalogId
        );
      }
      if (inclusiveAdjustments.length > 0) {
        fiatEstimate.fees = inclusiveAdjustments.map(
          ({ catalogId: _, ...adjustmentsWithoutCatalogId }) =>
            adjustmentsWithoutCatalogId
        );
      }
      body.fiatEstimate = fiatEstimate;
    }

    ctx.body = body;
    ctx.set("Cache-Control", `max-age=${oneMinuteInSeconds}`);
    ctx.response.status = 200;
  } catch (error) {
    if (
      error instanceof BadRequest ||
      (error instanceof Error && error.name === "BadRequest")
    ) {
      ctx.response.status = 400;
      ctx.body = error.message;
    } else {
      logger.error("Failed to get price for ArNS Purchase!", { error }, error);
      ctx.response.status = 503;
      ctx.body = "Price Oracle Unavailable";
    }
  }

  return next();
}
