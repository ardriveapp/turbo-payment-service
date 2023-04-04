import { randomUUID } from "crypto";
import { Next } from "koa";
import Stripe from "stripe";

import logger from "../logger";
import { KoaContext } from "../server";

let stripe: Stripe;

export async function priceQuote(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

  if (!STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key or webhook secret not set");
  }

  stripe ??= new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2022-11-15",
    appInfo: {
      // For sample support and debugging, not required for production:
      name: "ardrive-turbo",
      version: "0.0.0",
    },
    typescript: true,
  });

  const { pricingService, paymentDatabase } = ctx.state;

  const fiatValue = ctx.params.amount;
  const fiatCurrency = ctx.params.currency;

  const walletAddress = ctx.state.walletAddress;

  const quote = await pricingService.getWCForFiat(fiatCurrency, fiatValue);
  const user = await paymentDatabase.getUser(walletAddress);

  if (!user) {
    ctx.response.status = 404;
    ctx.body = "User not found";
    return next;
  }

  const balance = (await paymentDatabase.getUser(walletAddress))
    .winstonCreditBalance;

  const priceQuote = {
    topUpQuoteId: randomUUID(),
    destinationAddressType: "arweave",
    amount: fiatValue,
    winstonCreditAmount: quote,
    destinationAddress: walletAddress,
    currencyType: fiatCurrency,
    quoteExpirationDate: new Date(
      Date.now() + 1000 * 60 * 60 * 24 * 7
    ).toISOString(),
    paymentProvider: "stripe",
  };

  try {
    await paymentDatabase.createTopUpQuote(priceQuote);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(fiatValue * 100), // Convert to cents
      currency: fiatCurrency,
      metadata: {
        topUpQuoteId: priceQuote.topUpQuoteId,
      },
    });
    ctx.response.status = 200;
    ctx.body = {
      balance,
      priceQuote,
      paymentIntent,
    };
  } catch (error) {
    logger.error(error);
    ctx.response.status = 502;
    ctx.body = "Error creating payment intent";
  }
  return next;
}
