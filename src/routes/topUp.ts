import { randomUUID } from "crypto";
import { Next } from "koa";
import Stripe from "stripe";

import {
  CurrencyLimitations,
  electronicallySuppliedServicesTaxCode,
  paymentIntentTopUpMethod,
  topUpMethods,
} from "../constants";
import { PaymentValidationError } from "../database/errors";
import { MetricRegistry } from "../metricRegistry";
import { KoaContext } from "../server";
import { WC } from "../types/arc";
import { Payment } from "../types/payment";
import { winstonToArc } from "../types/winston";
import { isValidArweaveBase64URL } from "../utils/base64";

export async function topUp(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;

  const { pricingService, paymentDatabase, stripe } = ctx.state;
  const { amount, currency, method, address: destinationAddress } = ctx.params;

  const loggerObject = { amount, currency, method, destinationAddress };

  if (!topUpMethods.includes(method)) {
    ctx.response.status = 400;
    ctx.body = `Payment method must include one of: ${topUpMethods.toString()}!`;
    logger.info("top-up GET -- Invalid payment method", loggerObject);
    return next;
  }

  if (!isValidArweaveBase64URL(destinationAddress)) {
    ctx.response.status = 403;
    ctx.body = "Destination address is not a valid Arweave native address!";
    logger.info("top-up GET -- Invalid destination address", loggerObject);
    return next;
  }

  let currencyLimitations: CurrencyLimitations;

  try {
    currencyLimitations = await pricingService.getCurrencyLimitations();
  } catch (error) {
    logger.error(error);
    ctx.response.status = 502;
    ctx.body = "Fiat Oracle Unavailable";
    return next;
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

    return next;
  }

  let winstonCreditAmount: WC;
  try {
    winstonCreditAmount = await pricingService.getWCForPayment(payment);
  } catch (error: unknown) {
    logger.error(error);
    ctx.response.status = 502;
    ctx.body = "Fiat Oracle Unavailable";

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
    logger.info(`Creating stripe ${method}...`, loggerObject);
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
    MetricRegistry.stripeSessionCreationErrorCounter.inc();
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
