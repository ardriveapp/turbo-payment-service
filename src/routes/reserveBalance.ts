import { Next } from "koa";

import logger from "../logger";
import { KoaContext } from "../server";
import { Winston } from "../types/winston";

export async function reserveBalance(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });

  const { paymentDatabase } = ctx.state;

  if (!ctx.request.headers.authorization || !ctx.state.user) {
    ctx.response.status = 401;
    ctx.body = "Unauthorized";
    return next;
  }

  if (!ctx.params.walletAddress || !ctx.params.winstonCredits) {
    ctx.response.status = 403;
    ctx.body = "Missing parameters";
    return next;
  }

  const winstonCreditsToReserve: Winston = new Winston(
    ctx.params.winstonCredits
  );
  const walletAddressToCredit: string = ctx.params.walletAddress;

  let user;
  try {
    user = await paymentDatabase.getUser(walletAddressToCredit);
  } catch (error) {
    ctx.response.status = 403;
    ctx.response.message = "User not found";
    return next;
  }

  if (winstonCreditsToReserve.isGreaterThan(user.winstonCreditBalance)) {
    ctx.response.status = 403;
    ctx.response.message = "Insufficient balance";
    return next;
  } else {
    try {
      await paymentDatabase.reserveBalance(
        walletAddressToCredit,
        winstonCreditsToReserve
      );
      ctx.response.status = 200;
      ctx.response.message = "Balance reserved";
      logger.info(
        "Balance reserved for user ",
        walletAddressToCredit,
        " | ",
        winstonCreditsToReserve
      );

      return next;
    } catch (error) {
      ctx.response.status = 502;
      ctx.response.message = "Error reserving balance";
      return next;
    }
  }
}
