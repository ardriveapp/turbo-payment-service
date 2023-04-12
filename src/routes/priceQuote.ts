import { randomUUID } from "crypto";
import { Next } from "koa";

import { UserNotFoundWarning } from "../database/errors";
import logger from "../logger";
import { KoaContext } from "../server";
import { WC } from "../types/arc";
import { Winston } from "../types/winston";

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
  let quote: WC;
  try {
    quote = await pricingService.getWCForFiat(fiatCurrency, fiatValue);
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
    amount: fiatValue,
    winstonCreditAmount: quote,
    destinationAddress: walletAddress,
    currencyType: fiatCurrency,
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
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(fiatValue * 100), // TODO: Add proper types for fiat. Stripe takes amount in smallest unit of currency
      currency: fiatCurrency,
      metadata: {
        topUpQuoteId: priceQuote.topUpQuoteId,
      },
    });
    ctx.response.status = 200;

    ctx.body = {
      balance: existingBalance,
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
