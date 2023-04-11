import { Next } from "koa";

import logger from "../logger";
import { KoaContext } from "../server";
import { Winston } from "../types/winston";

export async function refundBalance(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });

  const { paymentDatabase } = ctx.state;

  if (!ctx.request.headers.authorization || !ctx.state.user) {
    ctx.response.status = 401;
    ctx.body = "Unauthorized";
    return next;
  }

  if (!ctx.params.walletAddress || !ctx.params.winstonCredits) {
    ctx.response.status = 400;
    ctx.body = "Missing parameters";
    return next;
  }

  const walletAddressToRefund: string = ctx.params.walletAddress;
  const winstonCreditsToRefund: Winston = new Winston(
    ctx.params.winstonCredits
  );

  try {
    const user = await paymentDatabase.getUser(walletAddressToRefund);
    logger.info(
      "Refunding balance for user ",
      user.userAddress,
      " | ",
      winstonCreditsToRefund
    );
  } catch (error) {
    ctx.response.status = 403;
    ctx.response.message = "User not found";
    return next;
  }

  try {
    await paymentDatabase.refundBalance(
      walletAddressToRefund,
      winstonCreditsToRefund
    );
    ctx.response.status = 200;
    ctx.response.message = "Balance refunded";
    logger.info(
      "Balance refund processed for user ",
      walletAddressToRefund,
      " | ",
      winstonCreditsToRefund
    );
    return next;
  } catch (error) {
    ctx.response.status = 502;
    ctx.response.message = "Error refunding balance";
    return next;
  }
}
