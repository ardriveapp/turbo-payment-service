import { randomUUID } from "crypto";
import { Next } from "koa";
import Stripe from "stripe";

import { paymentIntentTopUpMethod, topUpMethods } from "../constants";
import {
  PaymentValidationErrors,
  UserNotFoundWarning,
} from "../database/errors";
import logger from "../logger";
import { KoaContext } from "../server";
import { WC } from "../types/arc";
import { Payment } from "../types/payment";
import { Winston } from "../types/winston";

export async function topUp(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });

  const { pricingService, paymentDatabase, stripe } = ctx.state;
  const { amount, currency, method } = ctx.params;
  if (!topUpMethods.includes(method)) {
    ctx.response.status = 400;
    ctx.body = `Payment method must include one of: ${topUpMethods.toString()}!`;
    return next;
  }

  const walletAddress = ctx.state.walletAddress;

  if (!walletAddress) {
    ctx.response.status = 403;
    ctx.body = "Wallet address not provided";
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
  } catch (error) {
    logger.error(error);
    ctx.response.status = 400;
    ctx.body = "ArweaveToFiat Oracle Error";
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
    destinationAddress: walletAddress,
    currencyType: payment.type,
    quoteExpirationDate: fiveMinutesFromNow,
    paymentProvider: "stripe",
  };

  let intentOrCheckout:
    | Stripe.Response<Stripe.PaymentIntent>
    | Stripe.Response<Stripe.Checkout.Session>;
  try {
    if (method === paymentIntentTopUpMethod) {
      intentOrCheckout = await stripe.paymentIntents.create({
        amount: payment.amount,
        currency: payment.type,
        metadata: {
          topUpQuoteId: topUpQuote.topUpQuoteId,
        },
      });
    } else {
      intentOrCheckout = await stripe.checkout.sessions.create({
        // TODO: Success and Cancel URLS (Do we need app origin? e.g: ArDrive Widget, Top Up Page, ario-turbo-cli)
        success_url: "https://app.ardrive.io",
        cancel_url: "https://app.ardrive.io",
        currency: payment.type,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              product_data: { name: "ARC" },
              currency: payment.type,
              unit_amount: payment.amount,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          metadata: {
            topUpQuoteId: topUpQuote.topUpQuoteId,
            destinationAddress: walletAddress,
          },
        },
        mode: "payment",
      });
    }
  } catch (error) {
    if ((error as any).raw.code === "amount_too_small") {
      ctx.response.status = 400;
      ctx.body = "That payment amount is too small to accept!";
    } else {
      ctx.response.status = 502;
      ctx.body = `Error creating ${method}!`;
      logger.error(error);
    }
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

  let existingBalance: WC = new Winston("0");
  try {
    existingBalance = await paymentDatabase.getBalance(walletAddress);
  } catch (error) {
    if (error instanceof UserNotFoundWarning) {
      logger.info(
        "User not found, new user will be created on payment success"
      );
    } else {
      logger.error(error);
      // Log the error, but continue the route and return the existing balance as 0
    }
  }

  ctx.body = {
    balance: existingBalance,
    topUpQuote,
    paymentSession: intentOrCheckout,
  };
  ctx.response.status = 200;

  return next;
}
