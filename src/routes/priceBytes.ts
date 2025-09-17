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

import { oneMinuteInSeconds } from "../constants";
import { KoaContext } from "../server";
import { ByteCount } from "../types";

export async function priceBytesHandler(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;
  const { pricingService } = ctx.state;

  const bytesValue = ctx.params.amount;

  logger.debug("GET request for price of winc for a given byte count", {
    bytesValue,
  });

  if (Number(bytesValue) > Number.MAX_SAFE_INTEGER) {
    ctx.response.status = 400;
    ctx.body = "Byte count too large";
    logger.warn("Byte count too large", { bytesValue });
    return next();
  }
  let bytes: ByteCount;
  try {
    bytes = ByteCount(Number(bytesValue));
  } catch (error) {
    ctx.response.status = 400;
    ctx.body = "Invalid byte count";
    logger.error("Invalid byte count", { bytesValue }, error);
    return next();
  }
  try {
    // TODO: Optionally accept a wallet address to include user specific adjustments
    const priceWithAdjustments = await pricingService.getWCForBytes(
      bytes /* , userAddress */
    );
    const { adjustments, finalPrice } = priceWithAdjustments;
    ctx.response.status = 200;
    ctx.set("Cache-Control", `max-age=${oneMinuteInSeconds}`);
    ctx.body = {
      winc: finalPrice.winc.toString(),
      adjustments,
    };
    logger.debug("Successfully calculated price for byte count", {
      ...priceWithAdjustments,
    });
  } catch (error) {
    ctx.response.status = 503;
    ctx.body = "Pricing Oracle Unavailable";
    logger.error("Pricing Oracle Unavailable", { bytesValue });
  }
  return next();
}
