import { randomUUID } from "crypto";
import { Next } from "koa";

import logger from "../logger";
import { KoaContext } from "../server";

export async function priceQuoteHandler(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });
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

  const priceQuote = paymentDatabase.createTopUpQuote({
    topUpQuoteId: randomUUID(),
    destinationAddressType: "arweave",
    amount: fiatValue,
    winstonCreditAmount: quote,
    destinationAddress: walletAddress,
    currencyType: fiatCurrency,
    quoteExpirationDate: (Date.now() + 1000 * 60 * 60 * 24 * 7).toString(),
    paymentProvider: "stripe",
  });

  try {
    ctx.response.status = 200;
    ctx.body = {
      balance,
      priceQuote,
    };
  } catch (error) {
    logger.error(error);
    ctx.response.status = 502;
    ctx.body = "Pricing Oracle Unavailable";
  }
  return next;
}
