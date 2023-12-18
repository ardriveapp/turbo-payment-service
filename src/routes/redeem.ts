/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
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
import validator from "validator";

import { User } from "../database/dbTypes";
import { GiftRedemptionError } from "../database/errors";
import { KoaContext } from "../server";
import { isValidArweaveBase64URL } from "../utils/base64";
import { validateSingularQueryParameter } from "../utils/validators";

export async function redeem(ctx: KoaContext, next: Next): Promise<void> {
  const { paymentDatabase, logger: _logger } = ctx.state;
  let logger = _logger;

  const {
    email: rawEmail,
    destinationAddress: rawDestinationAddress,
    id: rawPaymentReceiptId,
  } = ctx.query;

  const email = validateSingularQueryParameter(ctx, rawEmail);
  const destinationAddress = validateSingularQueryParameter(
    ctx,
    rawDestinationAddress
  );
  const paymentReceiptId = validateSingularQueryParameter(
    ctx,
    rawPaymentReceiptId
  );
  if (!email || !destinationAddress || !paymentReceiptId) {
    return next();
  }

  if (!isValidArweaveBase64URL(destinationAddress)) {
    ctx.response.status = 400;
    ctx.body =
      "Provided destination address is not a valid Arweave native address!";
    logger.info("top-up GET -- Invalid destination address", ctx.params);
    return next();
  }

  if (!validator.isEmail(email)) {
    ctx.response.status = 400;
    ctx.body = "Provided recipient email address is not a valid email!";
    logger.info("top-up GET -- Invalid destination address", ctx.params);
    return next();
  }
  const recipientEmail = validator.escape(email);

  logger = logger.child({
    destinationAddress,
    paymentReceiptId,
  });

  let user: User;
  try {
    logger.info("Redeeming payment receipt");
    user = await paymentDatabase.redeemGift({
      destinationAddress,
      paymentReceiptId,
      recipientEmail,
    });
  } catch (error) {
    if (error instanceof GiftRedemptionError) {
      ctx.response.status = 400;
      ctx.body = error.message;
      logger.info(error.message);
      return next();
    }
    const message =
      "Error while redeeming payment receipt. Unable to reach Database!";
    logger.error("Error redeeming payment receipt");
    ctx.response.status = 503;
    ctx.body = message;
    return next();
  }

  const message = `Payment receipt redeemed for ${user.winstonCreditBalance} winc!`;

  logger = logger.child({ user });
  logger.info(message);

  ctx.response.status = 200;
  ctx.body = {
    message,
    userBalance: user.winstonCreditBalance,
    userAddress: user.userAddress,
    userCreationDate: user.userCreationDate,
  };

  return next();
}
