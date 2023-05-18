import { Next } from "koa";

import { UserNotFoundWarning } from "../database/errors";
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

  logger.info("Balance requested", { walletAddress });

  try {
    const balance = await paymentDatabase.getBalance(walletAddress);
    ctx.body = balance.toString();
    logger.info("Balance found!", { balance, walletAddress });
  } catch (error) {
    if (error instanceof UserNotFoundWarning) {
      logger.info(error.message);
      ctx.response.status = 404;
      ctx.body = "User Not Found";
    } else {
      logger.error(error);
      ctx.response.status = 503;
      ctx.body = "Cloud Database Unavailable";
    }
  }

  return next;
}
