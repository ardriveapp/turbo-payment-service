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

import { ExposedCurrencyLimitations, oneHourInSeconds } from "../constants";
import { KoaContext } from "../server";
import {
  SupportedFiatPaymentCurrencyType,
  supportedFiatPaymentCurrencyTypes,
  zeroDecimalCurrencyTypes,
} from "../types/supportedCurrencies";

export async function currenciesRoute(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;

  logger.debug("Currencies requested");

  try {
    const limits = await ctx.state.pricingService.getCurrencyLimitations();

    const exposedLimits: ExposedCurrencyLimitations = Object.entries(
      limits
    ).reduce((acc, [curr, limitation]) => {
      acc[curr as SupportedFiatPaymentCurrencyType] = {
        ...limitation,
        zeroDecimalCurrency: zeroDecimalCurrencyTypes.includes(
          curr as SupportedFiatPaymentCurrencyType
        ),
      };
      return acc;
    }, {} as ExposedCurrencyLimitations);

    ctx.body = {
      supportedCurrencies: supportedFiatPaymentCurrencyTypes,
      limits: exposedLimits,
    };
    ctx.status = 200;
    ctx.set("Cache-Control", `max-age=${oneHourInSeconds}`);
  } catch (error) {
    ctx.body = "Fiat Oracle Unavailable";
    ctx.status = 503;
  }

  return next();
}
