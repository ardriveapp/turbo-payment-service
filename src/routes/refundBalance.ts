/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { Next } from "koa";

import { UserNotFoundWarning } from "../database/errors";
import { KoaContext } from "../server";
import {
  validateAuthorizedRoute,
  validateQueryParameters,
  validateWinstonCreditAmount,
} from "../utils/validators";

export async function refundBalance(ctx: KoaContext, next: Next) {
  const { paymentDatabase, logger } = ctx.state;
  const { signerAddress } = ctx.params;

  if (validateAuthorizedRoute(ctx) === false) {
    return next();
  }

  const { winstonCredits, dataItemId: rawDataItemId } = ctx.query;
  const queryParameters = [winstonCredits, rawDataItemId];
  if (!validateQueryParameters(ctx, queryParameters)) {
    return next();
  }

  // TODO: do some regex validation on the dataItemId
  const [stringWinstonCredits, dataItemId] = queryParameters;

  const winstonCreditsToRefund = validateWinstonCreditAmount(
    ctx,
    stringWinstonCredits
  );
  if (!winstonCreditsToRefund) {
    return next();
  }

  logger.debug("Refunding balance for user ", {
    signerAddress,
    winstonCreditsToRefund,
    dataItemId,
  });
  try {
    await paymentDatabase.refundBalance(
      signerAddress,
      winstonCreditsToRefund,
      dataItemId
    );
    ctx.response.status = 200;
    ctx.response.message = "Balance refunded";
    logger.info("Balance refund processed", {
      signerAddress,
      winstonCreditsToRefund,
      dataItemId,
    });
  } catch (error: UserNotFoundWarning | unknown) {
    if (error instanceof UserNotFoundWarning) {
      ctx.response.status = 404;
      ctx.response.message = "User not found";
      logger.error(error.message, {
        signerAddress,
        winstonCreditsToRefund,
      });
    } else {
      ctx.response.status = 503;
      ctx.response.message = "Error refunding balance";
      logger.error("Error refunding balance", {
        signerAddress,
        winstonCreditsToRefund,
        error,
      });
    }
  }
  return next();
}
