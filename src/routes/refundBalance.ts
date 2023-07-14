import { Next } from "koa";

import { UserNotFoundWarning } from "../database/errors";
import { KoaContext } from "../server";
import { Winston } from "../types/winston";

export async function refundBalance(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;

  const { paymentDatabase } = ctx.state;
  const { winstonCredits, dataItemId } = ctx.query;
  const { walletAddress } = ctx.params;

  if (!ctx.request.headers.authorization || !ctx.state.user) {
    ctx.response.status = 401;
    ctx.body = "Unauthorized";
    logger.error("GET Refund balance route with no AUTHORIZATION!");
    return next();
  }

  if (!dataItemId || !winstonCredits) {
    ctx.response.status = 400;
    ctx.body = "Missing parameters";
    logger.error("GET Refund balance route with missing parameters!", {
      query: ctx.query,
      params: ctx.params,
    });
    return next();
  }

  // validate only one data item id is provided
  if (Array.isArray(dataItemId)) {
    ctx.response.status = 400;
    ctx.body = "Only one dataItemId can be provided";
    return next();
  }

  let winstonCreditsToRefund: Winston;
  try {
    winstonCreditsToRefund = new Winston(+winstonCredits);
  } catch (error) {
    ctx.response.status = 400;
    ctx.body = `Invalid value provided for winstonCredits: ${winstonCredits}`;
    return next();
  }

  logger.info("Refunding balance for user ", {
    walletAddress,
    winstonCreditsToRefund,
    dataItemId,
  });
  try {
    await paymentDatabase.refundBalance(
      walletAddress,
      winstonCreditsToRefund,
      dataItemId
    );
    ctx.response.status = 200;
    ctx.response.message = "Balance refunded";
    logger.info("Balance refund processed", {
      walletAddress,
      winstonCreditsToRefund,
      dataItemId,
    });
  } catch (error: UserNotFoundWarning | unknown) {
    if (error instanceof UserNotFoundWarning) {
      ctx.response.status = 404;
      ctx.response.message = "User not found";
      logger.info(error.message, {
        walletAddress,
        winstonCreditsToRefund,
      });
    } else {
      ctx.response.status = 502;
      ctx.response.message = "Error refunding balance";
      logger.error("Error refunding balance", {
        walletAddress,
        winstonCreditsToRefund,
        error,
      });
    }
  }
  return next();
}
