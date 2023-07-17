import { Next } from "koa";

import { BalanceReservationNotFoundError } from "../database/errors";
import { KoaContext } from "../server";
import { Winston } from "../types/winston";

export async function refundBalance(ctx: KoaContext, next: Next) {
  const { paymentDatabase, logger } = ctx.state;
  const { walletAddress } = ctx.params;
  // TODO: do some regex validation on the dataItemId
  const { winstonCredits, dataItemId } = ctx.query;

  if (!ctx.request.headers.authorization || !ctx.state.user) {
    ctx.response.status = 401;
    ctx.body = "Unauthorized";
    logger.error("GET Refund balance route with no AUTHORIZATION!");
    return next();
  }

  if (
    !dataItemId ||
    Array.isArray(dataItemId) ||
    !winstonCredits ||
    Array.isArray(winstonCredits)
  ) {
    ctx.response.status = 400;
    ctx.body = "Invalid parameters";
    logger.error("GET Refund balance route with invalid parameters!", {
      query: ctx.query,
      params: ctx.params,
    });
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
    await paymentDatabase.refundBalance({
      reservationId: dataItemId,
      refundedReason: "upload error",
    });
    ctx.response.status = 200;
    ctx.response.message = "Balance refunded";
    logger.info("Balance refund processed", {
      walletAddress,
      winstonCreditsToRefund,
      dataItemId,
    });
  } catch (error: BalanceReservationNotFoundError | unknown) {
    if (error instanceof BalanceReservationNotFoundError) {
      ctx.response.status = 400;
      ctx.response.message = "Reservation not found on refund";
      logger.error(error.message, {
        walletAddress,
        winstonCreditsToRefund,
        dataItemId,
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
