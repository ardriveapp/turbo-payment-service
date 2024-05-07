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
  electronicallySuppliedServicesTaxCode,
  isGiftingEnabled,
  paymentIntentTopUpMethod,
  topUpMethods,
  topUpQuoteExpirationMs,
} from "../constants";
import { CreateTopUpQuoteParams } from "../database/dbTypes";
import { PaymentValidationError, PromoCodeError } from "../database/errors";
import { MetricRegistry } from "../metricRegistry";
import { WincForPaymentResponse } from "../pricing/pricing";
import { KoaContext } from "../server";
import { Payment } from "../types/payment";
import { winstonToArc } from "../types/winston";
import { isValidUserAddress } from "../utils/base64";
import { parseQueryParams } from "../utils/parseQueryParams";
import {
  validateDestinationAddressType,
  validateGiftMessage,
  validateUiMode,
} from "../utils/validators";

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

  if (!topUpMethods.includes(method)) {
    ctx.response.status = 400;
    ctx.body = `Payment method must include one of: ${topUpMethods.toString()}!`;
    logger.info("top-up GET -- Invalid payment method", loggerObject);
    return next();
  }

  const {
    token: rawTokenType = "arweave",
    destinationAddressType: rawDestinationAddressType,
    giftMessage: rawGiftMessage,
    uiMode: rawUiMode,
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

  const uiMode = rawUiMode ? validateUiMode(ctx, rawUiMode) : "hosted";
  if (uiMode === false) {
    return next();
  }

  let destinationAddress: string;
  if (destinationAddressType === "email") {
    if (!isGiftingEnabled) {
      ctx.response.status = 403;
      ctx.body = "Gifting by email is disabled!";
      logger.info("top-up GET -- Gifting is disabled", loggerObject);
      return next();
    }

    if (!validator.isEmail(rawDestinationAddress)) {
      ctx.response.status = 400;
      ctx.body = "Destination address is not a valid email!";
      logger.info("top-up GET -- Invalid destination address", loggerObject);
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
    ctx.response.status = 502;
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
      logger.info(error.message, loggerObject);
    } else {
      logger.error(error);
      ctx.response.status = 502;
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
      ctx.response.status = 502;
      ctx.body = "Fiat Oracle Unavailable";
    }

    return next();
  }

  const quoteExpirationDate = new Date(
    Date.now() + topUpQuoteExpirationMs
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
  const stripeMetadata = adjustments.reduce(
    (acc, curr, i) => {
      // Add adjustments to stripe metadata
      // Stripe key name in metadata is limited to 40 characters, so we need to truncate the name.
      const keyName = `adj${i}_${curr.name}`.slice(0, 40);
      acc[keyName] = curr.adjustmentAmount.toString();
      return acc;
    },
    {
      ...stripeMetadataRaw,
      winstonCreditAmount: finalPrice.winc.toString(),
      referer,
    } as Record<string, string | number | null>
  );

  let intentOrCheckout:
    | Stripe.Response<Stripe.PaymentIntent>
    | Stripe.Response<Stripe.Checkout.Session>;
  try {
    logger.info(`Creating stripe ${method}...`, loggerObject);
    if (method === paymentIntentTopUpMethod) {
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

      const urls:
        | { success_url: string; cancel_url: string }
        | { redirect_on_completion: "never" } =
        uiMode === "embedded"
          ? {
              redirect_on_completion: "never",
            }
          : {
              //       // TODO: Success and Cancel URLS (Do we need app origin? e.g: ArDrive Widget, Top Up Page, ario-turbo-cli)
              success_url: "https://app.ardrive.io",
              cancel_url:
                destinationAddressType === "email"
                  ? `${giftUrl}?email=${destinationAddress}&amount=${
                      payment.amount
                    }${
                      urlEncodedGiftMessage
                        ? `&giftMessage=${urlEncodedGiftMessage}`
                        : ""
                    }`
                  : "https://app.ardrive.io",
            };

      intentOrCheckout = await stripe.checkout.sessions.create({
        ...urls,
        currency: payment.type,
        automatic_tax: {
          enabled: !!process.env.ENABLE_AUTO_STRIPE_TAX || false,
        },
        // Convert to stripe compatible timestamp, trim off precision
        expires_at: Math.floor(quoteExpirationMs / 1000),
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              product_data: {
                name: "Turbo Credits",
                description: `${winstonToArc(
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
        ui_mode: uiMode,
      });
    }
  } catch (error) {
    ctx.response.status = 502;
    ctx.body = `Error creating stripe payment session with method: ${method}!`;
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
    adjustments: adjustments.map((a) => {
      const { catalogId: _, ...adjustmentsWithoutCatalogId } = a;

      return adjustmentsWithoutCatalogId;
    }),
    fees: inclusiveAdjustments.map((a) => {
      const { catalogId: _, ...adjustmentsWithoutCatalogId } = a;

      return adjustmentsWithoutCatalogId;
    }),
  };
  ctx.response.status = 200;

  return next();
}
