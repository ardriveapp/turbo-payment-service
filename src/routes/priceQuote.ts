import { randomUUID } from "crypto";
import { Next } from "koa";

import logger from "../logger";
import { KoaContext } from "../server";

export async function priceQuote(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });

  const { pricingService, paymentDatabase, stripe } = ctx.state;

  const fiatValue = ctx.params.amount;
  const fiatCurrency = ctx.params.currency;

  const walletAddress = ctx.state.walletAddress;

  if (!walletAddress) {
    ctx.response.status = 403;
    ctx.body = "Wallet address not provided";
    return next;
  }
  let quote;
  try {
    quote = await pricingService.getWCForFiat(fiatCurrency, fiatValue);
  } catch (error) {
    logger.error(error);
    ctx.response.status = 400;
    ctx.body = "Invalid currency or amount";
    return next;
  }

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

  let user;
  try {
    user = await paymentDatabase.getUser(walletAddress);
  } catch (error) {
    logger.info("User not found, new user will be created on payment success");
  }

  try {
    await paymentDatabase.createTopUpQuote(priceQuote);

    const balance = user?.winstonCreditBalance || 0;

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
