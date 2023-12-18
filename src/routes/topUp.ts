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
import { randomUUID } from "crypto";
import { Next } from "koa";
import Stripe from "stripe";

import {
  CurrencyLimitations,
  electronicallySuppliedServicesTaxCode,
  paymentIntentTopUpMethod,
  topUpMethods,
} from "../constants";
import { CreateTopUpQuoteParams } from "../database/dbTypes";
import { PaymentValidationError, PromoCodeError } from "../database/errors";
import { MetricRegistry } from "../metricRegistry";
import { WincForPaymentResponse } from "../pricing/pricing";
import { KoaContext } from "../server";
import { Payment } from "../types/payment";
import { winstonToArc } from "../types/winston";
import { isValidArweaveBase64URL } from "../utils/base64";
import { parseQueryParams } from "../utils/parseQueryParams";

export async function topUp(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;

  const { pricingService, paymentDatabase, stripe } = ctx.state;
  const { amount, currency, method, address: destinationAddress } = ctx.params;

  const loggerObject = { amount, currency, method, destinationAddress };

  if (!topUpMethods.includes(method)) {
    ctx.response.status = 400;
    ctx.body = `Payment method must include one of: ${topUpMethods.toString()}!`;
    logger.info("top-up GET -- Invalid payment method", loggerObject);
    return next();
  }

  if (!isValidArweaveBase64URL(destinationAddress)) {
    ctx.response.status = 403;
    ctx.body = "Destination address is not a valid Arweave native address!";
    logger.info("top-up GET -- Invalid destination address", loggerObject);
    return next();
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
      userAddress: destinationAddress,
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

  const oneSecondMs = 1000;
  const oneMinuteMs = oneSecondMs * 60;
  const fiveMinutesMs = oneMinuteMs * 5;
  const fiveMinutesFromNow = new Date(Date.now() + fiveMinutesMs).toISOString();

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
    destinationAddressType: "arweave",
    paymentAmount: actualPaymentAmount,
    quotedPaymentAmount,
    winstonCreditAmount: finalPrice.winc,
    destinationAddress,
    currencyType: payment.type,
    quoteExpirationDate: fiveMinutesFromNow,
    paymentProvider: "stripe",
    adjustments,
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
      });
    } else {
      intentOrCheckout = await stripe.checkout.sessions.create({
        // TODO: Success and Cancel URLS (Do we need app origin? e.g: ArDrive Widget, Top Up Page, ario-turbo-cli)
        success_url: "https://app.ardrive.io",
        cancel_url: "https://app.ardrive.io",
        currency: payment.type,
        automatic_tax: {
          enabled: !!process.env.ENABLE_AUTO_STRIPE_TAX || false,
        },
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
