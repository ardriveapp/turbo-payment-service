import { randomUUID } from "crypto";
import { Next } from "koa";
import Stripe from "stripe";

import {
  electronicallySuppliedServicesTaxCode,
  paymentIntentTopUpMethod,
  topUpMethods,
} from "../constants";
import {
  PaymentAmountTooLarge,
  PaymentAmountTooSmall,
  PaymentValidationErrors,
} from "../database/errors";
import logger from "../logger";
import { KoaContext } from "../server";
import { WC } from "../types/arc";
import { Payment } from "../types/payment";
import { winstonToArc } from "../types/winston";
import { isValidArweaveBase64URL } from "../utils/base64";

export async function topUp(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });

  const { pricingService, paymentDatabase, stripe } = ctx.state;
  const { amount, currency, method, address: destinationAddress } = ctx.params;
  if (!topUpMethods.includes(method)) {
    ctx.response.status = 400;
    ctx.body = `Payment method must include one of: ${topUpMethods.toString()}!`;
    return next;
  }

  if (!isValidArweaveBase64URL(destinationAddress)) {
    ctx.response.status = 403;
    ctx.body = "Destination address is not a valid Arweave native address!";
    return next;
  }

  let payment: Payment;
  try {
    payment = new Payment({
      amount,
      type: currency,
    });
  } catch (error) {
    ctx.response.status = 400;
    ctx.body = (error as PaymentValidationErrors).message;
    return next;
  }

  let winstonCreditAmount: WC;
  try {
    winstonCreditAmount = await pricingService.getWCForPayment(payment);
  } catch (error: unknown) {
    if (
      error instanceof PaymentAmountTooLarge ||
      error instanceof PaymentAmountTooSmall
    ) {
      ctx.response.status = 400;
      ctx.body = error.message;
    } else {
      logger.error(error);
      ctx.response.status = 502;
      ctx.body = "Fiat Oracle Unavailable";
    }

    return next;
  }
  const oneSecondMs = 1000;
  const oneMinuteMs = oneSecondMs * 60;
  const fiveMinutesMs = oneMinuteMs * 5;
  const fiveMinutesFromNow = new Date(Date.now() + fiveMinutesMs).toISOString();

  const topUpQuote = {
    topUpQuoteId: randomUUID(),
    destinationAddressType: "arweave",
    paymentAmount: payment.amount,
    winstonCreditAmount,
    destinationAddress,
    currencyType: payment.type,
    quoteExpirationDate: fiveMinutesFromNow,
    paymentProvider: "stripe",
  };
  // Take all of topUpQuote to stripeMetadata except paymentProvider
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { paymentProvider, ...stripeMetadataRaw } = topUpQuote;
  const stripeMetadata = {
    ...stripeMetadataRaw,
    winstonCreditAmount: winstonCreditAmount.toString(),
  };

  let intentOrCheckout:
    | Stripe.Response<Stripe.PaymentIntent>
    | Stripe.Response<Stripe.Checkout.Session>;
  try {
    if (method === paymentIntentTopUpMethod) {
      intentOrCheckout = await stripe.paymentIntents.create({
        amount: payment.amount,
        currency: payment.type,
        metadata: stripeMetadata,
      });
    } else {
      intentOrCheckout = await stripe.checkout.sessions.create({
        // TODO: Success and Cancel URLS (Do we need app origin? e.g: ArDrive Widget, Top Up Page, ario-turbo-cli)
        success_url: "https://app.ardrive.io",
        cancel_url: "https://app.ardrive.io",
        currency: payment.type,
        automatic_tax: { enabled: true },
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              product_data: {
                name: "Turbo Credits",
                description: `${winstonToArc(
                  winstonCreditAmount
                )} credits on Turbo to destination address "${destinationAddress}"`,
                tax_code: electronicallySuppliedServicesTaxCode,
                metadata: stripeMetadata,
              },
              currency: payment.type,
              unit_amount: payment.amount,
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
    logger.error(error);
    return next;
  }

  try {
    await paymentDatabase.createTopUpQuote(topUpQuote);
  } catch (error) {
    logger.error(error);
    ctx.response.status = 503;
    ctx.body = "Cloud Database Unavailable";
    return next;
  }

  ctx.body = {
    topUpQuote,
    paymentSession: intentOrCheckout,
  };
  ctx.response.status = 200;

  return next;
}
