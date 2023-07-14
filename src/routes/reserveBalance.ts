import { Next } from "koa";

import { InsufficientBalance, UserNotFoundWarning } from "../database/errors";
import { KoaContext } from "../server";
<<<<<<< HEAD
import { ByteCount } from "../types/byteCount";
=======
import { ByteCount } from "../types";
>>>>>>> df18662 (fix(PE-4209): additional validation against query params, update tests, fix status codes)

export async function reserveBalance(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;

  const { paymentDatabase, pricingService } = ctx.state;
  const { walletAddress } = ctx.params;
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

<<<<<<< HEAD
  let byteCount: ByteCount;
  let walletAddressToCredit: string;

  const dataItemId = ctx.request.query.dataItemId as string | undefined;

  if (!ctx.params.walletAddress || !ctx.params.byteCount) {
    ctx.response.status = 403;
=======
  // validate we have what we need
  if (
    !rawByteCount ||
    Array.isArray(rawByteCount) ||
    !dataItemId ||
    Array.isArray(dataItemId)
  ) {
    ctx.response.status = 400;
>>>>>>> df18662 (fix(PE-4209): additional validation against query params, update tests, fix status codes)
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
    const winstonCredits = await pricingService.getWCForBytes(byteCount);

    logger.info("Reserving balance for user ", {
      walletAddress,
      byteCount,
      winstonCredits,
      dataItemId,
    });
    await paymentDatabase.reserveBalance(
      walletAddress,
      winstonCredits,
      dataItemId
    );
    ctx.response.status = 200;
    ctx.response.message = "Balance reserved";
    ctx.response.body = winstonCredits;

    logger.info("Balance reserved for user!", {
      walletAddress,
      byteCount,
      winstonCredits,
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
