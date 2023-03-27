import { Next } from "koa";

import logger from "../logger";
import { KoaContext } from "../server";

export async function balanceRoute(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });
  const { paymentDatabase } = ctx.state;

  const walletAddress = ctx.state.walletAddress;

  if (!walletAddress) {
    ctx.status = 403;
    ctx.body = "Invalid signature or missing required headers";
    return next;
  }

  logger.info(" balance requested for ", { walletAddress });

  try {
    const balance = await paymentDatabase.getUserBalance(walletAddress);
    ctx.body = balance;
  } catch (error) {
    logger.error(error);
    ctx.response.status = 503;
    ctx.body = "Cloud Database Unavailable";
  }

  return next;
}
