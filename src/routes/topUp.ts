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
import { randomUUID } from "crypto";
import { Next } from "koa";
import Stripe from "stripe";
import validator from "validator";

import {
  CurrencyLimitations,
  defaultTopUpCheckoutCancelUrl,
  defaultTopUpCheckoutSuccessUrl,
  electronicallySuppliedServicesTaxCode,
  isGiftingEnabled,
  paymentIntentStripeMethod,
  stripePaymentMethods,
  stripePaymentQuoteExpirationMs,
} from "../constants";
import { CreateTopUpQuoteParams } from "../database/dbTypes";
import {
  BadQueryParam,
  PaymentValidationError,
  PromoCodeError,
} from "../database/errors";
import { MetricRegistry } from "../metricRegistry";
import { WincForPaymentResponse } from "../pricing/pricing";
import { KoaContext } from "../server";
import { Payment } from "../types/payment";
import { winstonToCredits } from "../types/winston";
import { isValidUserAddress } from "../utils/base64";
import { toStripeMetadata } from "../utils/common";
import { parseQueryParams } from "../utils/parseQueryParams";
import {
  assertUiModeAndUrls,
  validateDestinationAddressType,
  validateGiftMessage,
} from "../utils/validators";

type StripeUiModeMetadata =
  | { ui_mode: "hosted"; success_url: string; cancel_url: string | undefined }
  | { ui_mode: "embedded"; redirect_on_completion: "never" }
  | { ui_mode: "embedded"; return_url: string };

export async function topUp(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;

  const { pricingService, paymentDatabase, stripe } = ctx.state;
  const {
    amount,
    currency,
    method,
    address: rawDestinationAddress,
  } = ctx.params;

  const referer = ctx.headers.referer;

  const loggerObject = { amount, currency, method, rawDestinationAddress };

  if (!stripePaymentMethods.includes(method)) {
    ctx.response.status = 400;
    ctx.body = `Payment method must include one of: ${stripePaymentMethods.toString()}!`;
    return next();
  }

  const {
    token: rawTokenType = "arweave",
    destinationAddressType: rawDestinationAddressType,
    giftMessage: rawGiftMessage,
    uiMode: rawUiMode,
    returnUrl: rawReturnUrl,
    successUrl: rawSuccessUrl,
    cancelUrl: rawCancelUrl,
  } = ctx.query;

  // First use destinationAddressType from backwards compatible routes ("email" address type), else use token
  const rawAddressType =
    rawDestinationAddressType !== undefined
      ? rawDestinationAddressType
      : rawTokenType;

  const destinationAddressType = validateDestinationAddressType(
    ctx,
    rawAddressType
  );
  if (!destinationAddressType) {
    return next();
  }

  const giftMessage = rawGiftMessage
    ? validateGiftMessage(ctx, rawGiftMessage)
    : undefined;
  if (giftMessage === false) {
    return next();
  }

  let stripeUiModeMetadata: StripeUiModeMetadata;

  try {
    const validatedQueryParams = assertUiModeAndUrls({
      cancelUrl: rawCancelUrl,
      returnUrl: rawReturnUrl,
      successUrl: rawSuccessUrl,
      uiMode: rawUiMode,
    });

    if (validatedQueryParams.uiMode === "hosted") {
      stripeUiModeMetadata = {
        ui_mode: validatedQueryParams.uiMode,
        success_url:
          validatedQueryParams.successUrl ?? defaultTopUpCheckoutSuccessUrl,
        cancel_url:
          validatedQueryParams.cancelUrl ?? defaultTopUpCheckoutCancelUrl,
      };
    } else {
      stripeUiModeMetadata = {
        ui_mode: validatedQueryParams.uiMode,
        ...(validatedQueryParams.returnUrl
          ? { return_url: validatedQueryParams.returnUrl }
          : { redirect_on_completion: "never" }),
      };
    }
  } catch (error) {
    // TODO: Expand this try catch to handle all errors thrown in route with Error instanceof catch pattern
    if (error instanceof BadQueryParam) {
      ctx.response.status = 400;
      ctx.body = error.message;
      logger.error(error.message, loggerObject);
    } else {
      ctx.response.status = 503;
      ctx.body = "Internal Server Error";
      logger.error(error);
    }
    return next();
  }

  let destinationAddress: string;
  if (destinationAddressType === "email") {
    if (!isGiftingEnabled) {
      ctx.response.status = 403;
      ctx.body = "Gifting by email is disabled!";
      return next();
    }

    if (!validator.isEmail(rawDestinationAddress)) {
      ctx.response.status = 400;
      ctx.body = "Destination address is not a valid email!";
      return next();
    }

    // Escape email address to prevent XSS
    destinationAddress = validator.escape(rawDestinationAddress);
  } else {
    if (!isValidUserAddress(rawDestinationAddress, destinationAddressType)) {
      ctx.response.status = 403;
      ctx.body =
        "Destination address is not a valid supported native wallet address!";
      logger.warn("Invalid destination address", loggerObject);
      return next();
    }

    destinationAddress = rawDestinationAddress;
  }

  let currencyLimitations: CurrencyLimitations;

  try {
    currencyLimitations = await pricingService.getCurrencyLimitations();
  } catch (error) {
    logger.error(error);
    ctx.response.status = 503;
    ctx.body = "Fiat Oracle Unavailable";
    return next();
  }

  let payment: Payment;
  try {
    payment = new Payment({
      amount,
      type: currency,
      currencyLimitations,
    });
  } catch (error) {
    if (error instanceof PaymentValidationError) {
      ctx.response.status = 400;
      ctx.body = error.message;
    } else {
      logger.error(error);
      ctx.response.status = 503;
      ctx.body = "Fiat Oracle Unavailable";
    }

    return next();
  }

  const promoCodes = parseQueryParams(ctx.query.promoCode);

  let wincForPaymentResponse: WincForPaymentResponse;
  try {
    wincForPaymentResponse = await pricingService.getWCForPayment({
      payment,
      userAddress: rawDestinationAddress,
      promoCodes,
    });
  } catch (error) {
    if (error instanceof PromoCodeError) {
      logger.warn("Failed to get price with Promo Code:", {
        payment,
        message: error.message,
      });
      ctx.response.status = 400;
      ctx.body = error.message;
    } else {
      logger.error(error);
      ctx.response.status = 503;
      ctx.body = "Fiat Oracle Unavailable";
    }

    return next();
  }

  const quoteExpirationDate = new Date(
    Date.now() + stripePaymentQuoteExpirationMs
  ).toISOString();
  const quoteExpirationMs = new Date(quoteExpirationDate).getTime();

  const {
    adjustments,
    inclusiveAdjustments,
    finalPrice,
    actualPaymentAmount,
    quotedPaymentAmount,
  } = wincForPaymentResponse;

  // TODO: Allow users to top up for free with promo codes

  const topUpQuote: CreateTopUpQuoteParams = {
    topUpQuoteId: randomUUID(),
    destinationAddressType,
    paymentAmount: actualPaymentAmount,
    quotedPaymentAmount,
    winstonCreditAmount: finalPrice.winc,
    destinationAddress,
    currencyType: payment.type,
    quoteExpirationDate,
    paymentProvider: "stripe",
    adjustments,
    giftMessage,
  };

  const { paymentProvider, adjustments: _a, ...stripeMetadataRaw } = topUpQuote;
  const stripeMetadata = toStripeMetadata({
    adjustments,
    baseMetadata: {
      ...stripeMetadataRaw,
      winstonCreditAmount: finalPrice.winc.toString(),
      referer: referer ?? null,
    },
  });

  const payment_method_types = ["card"];
  if (
    stripeUiModeMetadata.ui_mode === "hosted" ||
    "return_url" in stripeUiModeMetadata
  ) {
    payment_method_types.push("crypto");
  }

  let intentOrCheckout:
    | Stripe.Response<Stripe.PaymentIntent>
    | Stripe.Response<Stripe.Checkout.Session>;
  try {
    logger.debug(`Creating stripe ${method}...`, loggerObject);
    if (method === paymentIntentStripeMethod) {
      intentOrCheckout = await stripe.paymentIntents.create({
        amount: actualPaymentAmount,
        currency: payment.type,
        metadata: stripeMetadata,
        payment_method_types: ["card"],
      });
    } else {
      const localGiftUrl = `http://localhost:5173`;
      const prodGiftUrl = `https://gift.ardrive.io`;
      const giftUrl =
        process.env.NODE_ENV === "prod" || process.env.NODE_ENV === "dev"
          ? prodGiftUrl
          : localGiftUrl;

      const urlEncodedGiftMessage = giftMessage
        ? encodeURIComponent(giftMessage)
        : undefined;

      if (
        stripeUiModeMetadata.ui_mode === "hosted" &&
        stripeUiModeMetadata.cancel_url === undefined
      ) {
        if (destinationAddressType === "email") {
          const queryParams = new URLSearchParams({
            email: destinationAddress,
            amount: payment.amount.toString(),
          });
          if (urlEncodedGiftMessage) {
            queryParams.append("giftMessage", urlEncodedGiftMessage);
          }

          stripeUiModeMetadata.cancel_url = `${giftUrl}?${queryParams.toString()}`;
        } else {
          stripeUiModeMetadata.cancel_url = defaultTopUpCheckoutCancelUrl;
        }
      }
      intentOrCheckout = await stripe.checkout.sessions.create({
        ...stripeUiModeMetadata,
        currency: payment.type,
        automatic_tax: {
          enabled: !!process.env.ENABLE_AUTO_STRIPE_TAX || false,
        },
        // Convert to stripe compatible timestamp, trim off precision
        expires_at: Math.floor(quoteExpirationMs / 1000),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payment_method_types: payment_method_types as any, // Stripe supports crypto payments, but types are not updated yet
        line_items: [
          {
            price_data: {
              product_data: {
                name: "Turbo Credits",
                description: `${winstonToCredits(
                  finalPrice.winc
                )} credits on Turbo to destination address "${destinationAddress}"`,
                tax_code: electronicallySuppliedServicesTaxCode,
                metadata: stripeMetadata,
              },
              currency: payment.type,
              unit_amount: actualPaymentAmount,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          metadata: stripeMetadata,
        },
        mode: "payment",
      });
    }
  } catch (error) {
    ctx.response.status = 503;
    ctx.body = `Error creating stripe payment session! ${
      error instanceof Error ? error.message : error
    }`;
    MetricRegistry.stripeSessionCreationErrorCounter.inc();
    logger.error(error);
    return next();
  }

  try {
    await paymentDatabase.createTopUpQuote({
      ...topUpQuote,
      adjustments: [...adjustments, ...inclusiveAdjustments],
    });
  } catch (error) {
    logger.error(error);
    ctx.response.status = 503;
    ctx.body = "Cloud Database Unavailable";
    return next();
  }

  ctx.body = {
    topUpQuote,
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

  return next();
}
