import { randomUUID } from "crypto";
import { Next } from "koa";

import {
  PaymentValidationErrors,
  UserNotFoundWarning,
} from "../database/errors";
import logger from "../logger";
import { KoaContext } from "../server";
import { WC } from "../types/arc";
import { Payment } from "../types/payment";
import { Winston } from "../types/winston";

export async function priceQuote(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });

  const { pricingService, paymentDatabase, stripe } = ctx.state;

  const walletAddress = ctx.state.walletAddress;

  if (!walletAddress) {
    ctx.response.status = 403;
    ctx.body = "Wallet address not provided";
    return next;
  }

  let payment: Payment;
  try {
    payment = new Payment({
      amount: ctx.params.amount,
      type: ctx.params.currency,
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

  const thirtyMinutesFromNow = new Date(
    Date.now() + 1000 * 60 * 30
  ).toISOString();

  const priceQuote = {
    topUpQuoteId: randomUUID(),
    destinationAddressType: "arweave",
    paymentAmount: payment.amount,
    winstonCreditAmount,
    destinationAddress: walletAddress,
    currencyType: payment.type,
    quoteExpirationDate: thirtyMinutesFromNow,
    paymentProvider: "stripe",
  };

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
      ctx.response.status = 503;
      ctx.body = "Cloud Database Unavailable";
      return next;
    }
  }

  try {
    await paymentDatabase.createTopUpQuote(priceQuote);
  } catch (error) {
    logger.error(error);
    ctx.response.status = 503;
    ctx.body = "Cloud Database Unavailable";
    return next;
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
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
          topUpQuoteId: priceQuote.topUpQuoteId,
          destinationAddress: walletAddress,
        },
      },
      mode: "payment",
    });

    ctx.response.status = 200;

    ctx.body = {
      balance: existingBalance,
      priceQuote,
      checkoutSession,
    };
  } catch (error) {
    logger.error(error);
    ctx.response.status = 502;
    ctx.body = "Error creating payment intent";
  }
  return next;
}
