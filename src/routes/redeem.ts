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
import validator from "validator";

import { User } from "../database/dbTypes";
import { GiftRedemptionError } from "../database/errors";
import { KoaContext } from "../server";
import { WC } from "../types";
import { isValidUserAddress } from "../utils/base64";
import {
  validateSingularQueryParameter,
  validateUserAddressType,
} from "../utils/validators";

export async function redeem(ctx: KoaContext, next: Next): Promise<void> {
  const { paymentDatabase, logger: _logger } = ctx.state;
  let logger = _logger;

  const {
    email: rawEmail,
    destinationAddress: rawDestinationAddress,
    id: rawPaymentReceiptId,
    token: rawUserAddressType = "arweave",
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
  const userAddressType = validateUserAddressType(ctx, rawUserAddressType);
  if (!email || !destinationAddress || !paymentReceiptId || !userAddressType) {
    return next();
  }

  if (!isValidUserAddress(destinationAddress, userAddressType)) {
    ctx.response.status = 400;
    ctx.body = "Provided destination address is not a valid native address!";
    return next();
  }

  if (!validator.isEmail(email)) {
    ctx.response.status = 400;
    ctx.body = "Provided recipient email address is not a valid email!";
    logger.warn("top-up GET -- Invalid destination address", ctx.params);
    return next();
  }
  const recipientEmail = validator.escape(email);

  logger = logger.child({
    destinationAddress,
    paymentReceiptId,
  });

  let user: User;
  let wincRedeemed: WC;
  try {
    logger.debug("Redeeming payment receipt");
    const res = await paymentDatabase.redeemGift({
      destinationAddress,
      destinationAddressType: userAddressType,
      paymentReceiptId,
      recipientEmail,
    });
    user = res.user;
    wincRedeemed = res.wincRedeemed;
  } catch (error) {
    if (error instanceof GiftRedemptionError) {
      ctx.response.status = 400;
      ctx.body = error.message;
      logger.error(error.message);
      return next();
    }
    const message =
      "Error while redeeming payment receipt. Unable to reach Database!";
    logger.error("Error redeeming payment receipt");
    ctx.response.status = 503;
    ctx.body = message;
    return next();
  }

  const message = `Payment receipt redeemed for ${wincRedeemed} winc!`;

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
