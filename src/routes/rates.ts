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

import {
  oneARInWinston,
  oneGiBInBytes,
  oneMinuteInSeconds,
  turboFeePercentageAsADecimal,
} from "../constants";
import { KoaContext } from "../server";
import { supportedPaymentCurrencyTypes } from "../types/supportedCurrencies";

export async function ratesHandler(ctx: KoaContext, next: Next) {
  const { pricingService, logger } = ctx.state;

  try {
    const priceWithAdjustments = await pricingService.getWCForBytes(
      oneGiBInBytes
    );
    const fiat: Record<string, number> = {};

    // Calculate fiat prices for one GiB
    await Promise.all(
      supportedPaymentCurrencyTypes.map(async (currency) => {
        const fiatPriceForOneAR = await pricingService.getFiatPriceForOneAR(
          currency
        );

        const fiatPriceForOneGiB =
          priceWithAdjustments.winc.times(fiatPriceForOneAR);
        const fiatValue =
          (fiatPriceForOneGiB.toBigNumber().toNumber() / oneARInWinston) *
          (1 + turboFeePercentageAsADecimal);

        fiat[currency] = fiatValue;
      })
    );
    const rates = {
      winc: priceWithAdjustments.winc.toString(),
      fiat,
      adjustments: priceWithAdjustments.adjustments,
    };
    ctx.status = 200;
    ctx.set("Cache-Control", `max-age=${oneMinuteInSeconds}`);
    ctx.body = rates;
    logger.info("Successfully calculated rates.", { rates });
  } catch (error) {
    ctx.status = 502;
    ctx.body = "Failed to calculate rates.";
    logger.error("Failed to calculate rates.", error);
  }
  return next();
}

export async function fiatToArRateHandler(ctx: KoaContext, next: Next) {
  const { logger, pricingService } = ctx.state;
  const { currency } = ctx.params;

  logger.info("Fetching raw conversion rate for 1 AR", {
    currency,
  });
  if (!supportedPaymentCurrencyTypes.includes(currency)) {
    ctx.status = 404;
    ctx.body = "Invalid currency.";
    return next();
  }

  try {
    const fiatPriceForOneAR = await pricingService.getFiatPriceForOneAR(
      currency
    );
    logger.info("Successfully fetched raw fiat conversion rate for 1 AR", {
      currency,
      rate: fiatPriceForOneAR,
    });
    ctx.status = 200;
    ctx.body = {
      currency,
      rate: fiatPriceForOneAR,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    ctx.status = 502;
    ctx.body = "Failed to fetch fiat conversion for 1 AR.";
    logger.error("Failed to fetch fiat conversion for 1 AR.", {
      error: message,
    });
  }
  return next();
}
