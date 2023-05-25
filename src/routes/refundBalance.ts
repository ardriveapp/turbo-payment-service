import { Next } from "koa";

import { UserNotFoundWarning } from "../database/errors";
import { KoaContext } from "../server";
import { Winston } from "../types/winston";

export async function refundBalance(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;

  const { paymentDatabase } = ctx.state;

  if (!ctx.request.headers.authorization || !ctx.state.user) {
    ctx.response.status = 401;
    ctx.body = "Unauthorized";
    logger.error("GET Refund balance route with no AUTHORIZATION!");
    return next;
  }

  let winstonCreditsToRefund: Winston;
  let walletAddressToRefund: string;

  if (!ctx.params.walletAddress || !ctx.params.winstonCredits) {
    ctx.response.status = 403;
    ctx.body = "Missing parameters";
    logger.error("GET Refund balance route with missing parameters!", {
      params: ctx.params,
    });
    return next;
  } else {
    try {
      winstonCreditsToRefund = new Winston(ctx.params.winstonCredits);
      walletAddressToRefund = ctx.params.walletAddress;
    } catch (error) {
      ctx.response.status = 403;
      ctx.body = "Invalid parameters";
      logger.error("GET Refund balance route with invalid parameters!", {
        params: ctx.params,
      });
      return next;
    }
  }

  logger.info("Refunding balance for user ", {
    walletAddressToRefund,
    winstonCreditsToRefund,
  });
  try {
    await paymentDatabase.refundBalance(
      walletAddressToRefund,
      winstonCreditsToRefund
    );
    ctx.response.status = 200;
    ctx.response.message = "Balance refunded";
    logger.info("Balance refund processed", {
      walletAddressToRefund,
      winstonCreditsToRefund,
    });
    return next;
  } catch (error: UserNotFoundWarning | unknown) {
    if (error instanceof UserNotFoundWarning) {
      ctx.response.status = 403;
      ctx.response.message = "User not found";
      logger.info(error.message, {
        walletAddressToRefund,
        winstonCreditsToRefund,
      });
      return next;
    }
    ctx.response.status = 502;
    ctx.response.message = "Error refunding balance";
    logger.error("Error refunding balance", {
      walletAddressToRefund,
      winstonCreditsToRefund,
      error,
    });
    return next;
  }
}
