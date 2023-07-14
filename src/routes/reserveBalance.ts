import { Next } from "koa";

import { InsufficientBalance, UserNotFoundWarning } from "../database/errors";
import { KoaContext } from "../server";
import { ByteCount } from "../types/byteCount";
import { TransactionId } from "../types/types";

export async function reserveBalance(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;

  const { paymentDatabase, pricingService } = ctx.state;

  if (!ctx.request.headers.authorization || !ctx.state.user) {
    ctx.response.status = 401;
    ctx.body = "Unauthorized";
    logger.error(
      "Unable to reserve balance. No authorization or user provided.",
      {
        user: ctx.state.user,
        headers: ctx.request.headers,
      }
    );
    return next();
  }

  let byteCount: ByteCount;
  let walletAddressToCredit: string;
  let dataItemId: TransactionId;

  if (
    !ctx.params.walletAddress ||
    !ctx.params.byteCount ||
    !ctx.params.dataItemId
  ) {
    ctx.response.status = 403;
    ctx.body = "Missing parameters";
    logger.error("GET Reserve balance route with missing parameters!", {
      params: ctx.params,
    });
    return next();
  } else {
    try {
      byteCount = ByteCount(+ctx.params.byteCount);
      walletAddressToCredit = ctx.params.walletAddress;
      dataItemId = ctx.params.dataItemId;
    } catch (error) {
      ctx.response.status = 403;
      ctx.body = "Invalid parameters";
      logger.error("GET Reserve balance route with invalid parameters!", {
        params: ctx.params,
      });
      return next();
    }
  }

  try {
    logger.info("Getting base credit amount for byte count...", {
      walletAddressToCredit,
      byteCount,
      dataItemId,
    });
    const winstonCredits = await pricingService.getWCForBytes(byteCount);

    logger.info("Reserving balance for user ", {
      walletAddressToCredit,
      byteCount,
      winstonCredits,
      dataItemId,
    });
    await paymentDatabase.reserveBalance(
      walletAddressToCredit,
      winstonCredits,
      dataItemId
    );
    ctx.response.status = 200;
    ctx.response.message = "Balance reserved";
    ctx.response.body = winstonCredits;

    logger.info("Balance reserved for user!", {
      walletAddressToCredit,
      byteCount,
      winstonCredits,
      dataItemId,
    });

    return next;
  } catch (error: UserNotFoundWarning | InsufficientBalance | unknown) {
    if (error instanceof UserNotFoundWarning) {
      ctx.response.status = 403;
      ctx.response.message = "User not found";
      logger.info(error.message, { walletAddressToCredit, byteCount });
      return next;
    }
    if (error instanceof InsufficientBalance) {
      ctx.response.status = 403;
      ctx.response.message = "Insufficient balance";
      logger.info(error.message, { walletAddressToCredit, byteCount });
      return next;
    }
    logger.error("Error reserving balance", {
      walletAddressToCredit,
      byteCount,
      error,
    });

    ctx.response.status = 502;
    ctx.response.message = "Error reserving balance";
    return next;
  }
}
