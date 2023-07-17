import { Next } from "koa";

import { InsufficientBalance, UserNotFoundWarning } from "../database/errors";
import { KoaContext } from "../server";
import { ByteCount } from "../types";

export async function reserveBalance(ctx: KoaContext, next: Next) {
  const { paymentDatabase, pricingService, logger } = ctx.state;
  const { walletAddress } = ctx.params;
  // TODO: do some regex validation on the dataItemId
  const { byteCount: rawByteCount, dataItemId } = ctx.query;

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

  // validate we have what we need
  if (
    // TODO: once the new service is converted, validate dataItemId exists here
    Array.isArray(dataItemId) ||
    !rawByteCount ||
    Array.isArray(rawByteCount)
  ) {
    ctx.response.status = 400;
    ctx.body = "Missing parameters";
    logger.error("GET Reserve balance route with missing parameters!", {
      ...ctx.params,
      ...ctx.query,
    });
    return next();
  }

  let byteCount: ByteCount;
  try {
    byteCount = ByteCount(+rawByteCount);
  } catch (error) {
    ctx.response.status = 400;
    ctx.body = `Invalid parameter for byteCount: ${rawByteCount}`;
    logger.error("GET Reserve balance route with invalid parameters!", {
      ...ctx.params,
      ...ctx.query,
    });
    return next();
  }

  try {
    logger.info("Getting base credit amount for byte count...", {
      walletAddress,
      byteCount,
      dataItemId,
    });
    // TODO: Expose adjustments via Reserve Balance
    const { winc /* adjustments */ } = await pricingService.getWCForBytes(
      byteCount
    );

    logger.info("Reserving balance for user ", {
      walletAddress,
      byteCount,
      winc,
      dataItemId,
    });
    await paymentDatabase.reserveBalance(walletAddress, winc, dataItemId);
    ctx.response.status = 200;
    ctx.response.message = "Balance reserved";

    // TODO: Adjust to JSON response body to Expose adjustments via Reserve balance (e.g: body = { winc, adjustments })
    ctx.response.body = winc;

    logger.info("Balance reserved for user!", {
      walletAddress,
      byteCount,
      winc,
      dataItemId,
    });

    return next();
  } catch (error: UserNotFoundWarning | InsufficientBalance | unknown) {
    if (error instanceof UserNotFoundWarning) {
      ctx.response.status = 404;
      ctx.response.message = "User not found";
      logger.info(error.message, { walletAddress, byteCount });
    } else if (error instanceof InsufficientBalance) {
      ctx.response.status = 402;
      ctx.response.message = "Insufficient balance";
      logger.info(error.message, { walletAddress, byteCount });
      return next();
    } else {
      logger.error("Error reserving balance", {
        walletAddress,
        byteCount,
        error,
      });

      ctx.response.status = 502;
      ctx.response.message = "Error reserving balance";
    }
  }
  return next();
}
