import { Next } from "koa";

import logger from "../logger";
import { KoaContext } from "../server";

export async function refundBalance(ctx: KoaContext, next: Next) {
  const { paymentDatabase } = ctx.state;

  let wrc = ctx.params.winstonCredits;
  let walletAddress = ctx.params.walletAddress;

  if (!wrc || !walletAddress) {
    ctx.response.status = 400;
    ctx.body = "Missing parameters";
    return next;
  }

  try {
    const user = await paymentDatabase.getUser(walletAddress);
    logger.info("Refunding balance for user ", user.userAddress, " | ", wrc);
  } catch (error) {
    ctx.response.status = 400;
    ctx.body = "User not found";
    return next;
  }

  try {
    await paymentDatabase.refundBalance(walletAddress, wrc);
    ctx.response.status = 200;
    logger.info(
      "Balance refund processed for user ",
      walletAddress,
      " | ",
      wrc
    );
    return next;
  } catch (error) {
    ctx.response.status = 400;
    ctx.body = "Error refunding balance";
    return next;
  }
}
