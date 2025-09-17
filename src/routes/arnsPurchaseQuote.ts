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
import { BadRequest as ArioSdkBadRequest } from "@ar.io/sdk";
import { randomUUID } from "crypto";
import { Next } from "koa";
import Stripe from "stripe";
import { Logger } from "winston";

import {
  defaultArNSCheckoutCancelUrl,
  defaultArNSCheckoutSuccessUrl,
  electronicallySuppliedServicesTaxCode,
  paymentAmountLimits,
  paymentIntentStripeMethod,
  stripePaymentQuoteExpirationMs,
} from "../constants";
import { ArNSPurchaseQuoteParams } from "../database/dbTypes";
import { BadRequest } from "../database/errors";
import { MetricRegistry } from "../metricRegistry";
import { KoaContext } from "../server";
import { StripeUiModeMetadata } from "../types";
import { Payment } from "../types/payment";
import { W } from "../types/winston";
import {
  formatStripeArNSPurchaseDescription,
  toStripeMetadata,
} from "../utils/common";
import { parseQueryParams } from "../utils/parseQueryParams";
import { getValidatedArNSPurchaseQuoteParams } from "../utils/validators";

/**
 * This route is used to create a purchase quote for an ArNS purchase.
 *
 * It performs the following steps:
 *
 * 1. Validates the request parameters.
 * 2. Calculates the mARIO quantity required for the purchase.
 * 3. Gets the winc price for the mARIO quantity with the fees added to the price
 * 4. Gets the fiat price for the mARIO quantity with the promo codes removed from the price
 * 5. Determines if any excess winc amount is needed to meet the minimum payment amount
 * 6. Creates a Stripe payment intent or checkout session with the calculated amounts
 * 7. Creates a purchase quote in the database with the calculated amounts
 * 8. Returns the purchase quote and payment session to the client
 * 9. Handles errors and logs them appropriately
 */
export async function arnsPurchaseQuote(ctx: KoaContext, next: Next) {
  const { pricingService, paymentDatabase, stripe, gatewayMap } = ctx.state;
  const { ario } = gatewayMap;

  let logger: Logger = ctx.state.logger.child({
    referer: ctx.headers.referer,
    method: "arnsPurchaseQuote",
  });

  try {
    const validatedParams = getValidatedArNSPurchaseQuoteParams(ctx);
    const {
      intent,
      method,
      name,
      uiMode,
      increaseQty,
      processId,
      type,
      currency,
      years,
      destinationAddress,
    } = validatedParams;
    logger = logger.child({ ...validatedParams });

    logger.debug("Getting mARIO quantity for purchase quote");
    const mARIOQty = await ario.getTokenCost({
      name,
      increaseQty,
      type,
      years,
      intent,
      assertBalance: true,
    });
    logger = logger.child({ mARIOQty: mARIOQty.valueOf() });

    logger.debug("Getting winc price for crypto payment");
    const {
      finalPrice: { winc: wincPriceForArNSPurchase },
      inclusiveAdjustments,
    } = await pricingService.getWCForCryptoPayment({
      amount: W(mARIOQty.valueOf()),
      token: "ario",
      // Add infra fee to the price, not take it out. This is this function is usually used for the case
      // where the user is paying with crypto, and we want to take the fee out of the winc amount given.
      // But here we are getting a winc quote for a fiat payment, so we want to add the fee to the price.
      feeMode: "invert",
    });
    logger = logger.child({
      wincPriceForArNSPurchase: wincPriceForArNSPurchase.valueOf(),
    });

    const promoCodes = parseQueryParams(ctx.query.promoCode);
    logger = logger.child({ promoCodes });

    logger.debug("Getting fiat payment quote for winc price of ArNS purchase");
    const price = await pricingService.getFiatPriceForCryptoAmount({
      amount: wincPriceForArNSPurchase.valueOf(),
      token: "arweave",
      type: currency,
      promoCodes,
      userAddress: destinationAddress,
    });
    logger = logger.child({ ...price });

    const { quotedPaymentAmount, adjustments } = price;
    let { paymentAmount } = price;
    const stripeMinimumPaymentAmount =
      paymentAmountLimits[currency].stripeMinimumPaymentAmount;

    let excessWincAmount = W(0);
    if (paymentAmount < stripeMinimumPaymentAmount) {
      logger.debug(
        `Payment amount ${paymentAmount} is less than stripe minimum payment amount ${stripeMinimumPaymentAmount}. Determining excess winc amount.`
      );
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
    logger = logger.child({ excessWincAmount: excessWincAmount.valueOf() });

    const payment = new Payment({
      amount: paymentAmount,
      type: currency,
    });

    // Get the usd AR and ARIO rates for DB historical exports
    const { usdArRate, usdArioRate } =
      await pricingService.getUSDPriceForOneARAndOneARIO();

    const nonce = randomUUID();
    const quoteExpirationDate = new Date(
      Date.now() + stripePaymentQuoteExpirationMs
    ).toISOString();
    const purchaseQuoteParams: ArNSPurchaseQuoteParams = {
      nonce,
      intent,
      mARIOQty,
      name,
      usdArioRate,
      usdArRate,
      wincQty: wincPriceForArNSPurchase,
      increaseQty,
      processId,
      type,
      years,
      owner: destinationAddress,
      paymentAmount: payment.amount,
      quotedPaymentAmount,
      currencyType: payment.type,
      quoteExpirationDate,
      paymentProvider: "stripe",
      excessWincAmount,
      adjustments,
    };

    logger = logger.child({
      ...purchaseQuoteParams,
    });
    logger.debug("ArNS purchase quote created");

    const {
      paymentProvider,
      adjustments: _a,
      ...rawStripeMetadata
    } = purchaseQuoteParams;
    const stripeMetadata = toStripeMetadata({
      adjustments,
      baseMetadata: {
        ...rawStripeMetadata,
        wincQty: wincPriceForArNSPurchase.valueOf(),
        excessWincAmount: excessWincAmount.valueOf(),
        mARIOQty: mARIOQty.valueOf(),
        referer: ctx.headers.referer ?? null,
      },
    });

    const payment_method_types = ["card"];
    if (validatedParams.uiMode === "hosted" || "returnUrl" in validatedParams) {
      payment_method_types.push("crypto");
    }

    let intentOrCheckout:
      | Stripe.Response<Stripe.PaymentIntent>
      | Stripe.Response<Stripe.Checkout.Session>;
    try {
      logger.debug(`Creating stripe ${method}...`);
      if (method === paymentIntentStripeMethod) {
        intentOrCheckout = await stripe.paymentIntents.create({
          amount: payment.amount,
          currency: payment.type,
          metadata: stripeMetadata,
          payment_method_types: ["card"],
        });
      } else {
        const stripeUiModeMetadata: StripeUiModeMetadata =
          uiMode === "hosted"
            ? {
                ui_mode: uiMode,
                success_url:
                  validatedParams.successUrl ?? defaultArNSCheckoutSuccessUrl,
                cancel_url:
                  validatedParams.cancelUrl ?? defaultArNSCheckoutCancelUrl,
              }
            : {
                ui_mode: uiMode,
                ...(validatedParams.returnUrl
                  ? { return_url: validatedParams.returnUrl }
                  : { redirect_on_completion: "never" }),
              };

        if (
          stripeUiModeMetadata.ui_mode === "hosted" &&
          stripeUiModeMetadata.cancel_url === undefined
        ) {
          stripeUiModeMetadata.cancel_url = defaultArNSCheckoutCancelUrl;
        }

        intentOrCheckout = await stripe.checkout.sessions.create({
          ...stripeUiModeMetadata,
          currency: payment.type,
          expires_at: Math.floor(
            new Date(quoteExpirationDate).getTime() / 1000
          ),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payment_method_types: payment_method_types as any, // Stripe supports crypto payments, but types are not updated yet
          payment_intent_data: {
            metadata: stripeMetadata,
          },
          mode: "payment",
          line_items: [
            {
              price_data: {
                product_data: {
                  name: "ArNS Purchase",
                  description: formatStripeArNSPurchaseDescription({
                    intent,
                    name,
                    increaseQty,
                    processId,
                    type,
                    years,
                  }),
                  tax_code: electronicallySuppliedServicesTaxCode,
                  metadata: stripeMetadata,
                },
                currency: payment.type,
                unit_amount: payment.amount,
              },
              quantity: 1,
            },
          ],
        });
      }
    } catch (error) {
      MetricRegistry.stripeSessionCreationErrorCounter.inc();
      throw error;
    }
    logger = logger.child({
      paymentIntentId: intentOrCheckout.id,
      intentOrCheckout,
    });

    logger.debug("Adding purchase quote to database");
    const purchaseQuote = await paymentDatabase.createArNSPurchaseQuote(
      purchaseQuoteParams
    );
    logger = logger.child({ ...purchaseQuote });

    ctx.body = {
      purchaseQuote,
      paymentSession: intentOrCheckout,
      adjustments: adjustments.map(
        ({ catalogId: _, ...adjustmentsWithoutCatalogId }) =>
          adjustmentsWithoutCatalogId
      ),
      fees: inclusiveAdjustments.map(
        ({ catalogId: _, ...adjustmentsWithoutCatalogId }) =>
          adjustmentsWithoutCatalogId
      ),
    };
    ctx.response.status = 200;
    logger.info("ArNS purchase quote created successfully");
  } catch (error) {
    if (error instanceof BadRequest || error instanceof ArioSdkBadRequest) {
      ctx.response.status = 400;
      ctx.body = error.message;
      logger.error(error.message);
    } else {
      ctx.response.status = 503;
      ctx.body =
        "Internal Server Error" +
        (error instanceof Error ? `: ${error.message}` : "");
      logger.error(error);
    }
  }

  return next();
}
