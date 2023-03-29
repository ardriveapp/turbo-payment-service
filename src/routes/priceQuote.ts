import { Next } from "koa";

import logger from "../logger";
import { KoaContext } from "../server";
import { ByteCount } from "../types/byteCount";

export async function priceQuoteHandler(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });
  const { pricingService, paymentDatabase } = ctx.state;

  const fiatValue = ctx.params.amount;
  const fiatCurrency = ctx.params.currency;

  const walletAddress = ctx.state.walletAddress;

  const quote = await pricingService.getWCForFiat(fiatCurrency, fiatValue);

  const balance = await paymentDatabase.getUserBalance(walletAddress);
  const priceQuote = paymentDatabase.createPriceQuote();

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
