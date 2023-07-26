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

import { ExposedCurrencyLimitations, oneHourInSeconds } from "../constants";
import { KoaContext } from "../server";
import {
  SupportedPaymentCurrencyTypes,
  supportedPaymentCurrencyTypes,
  zeroDecimalCurrencyTypes,
} from "../types/supportedCurrencies";

export async function currenciesRoute(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;

  logger.info("Currencies requested");

  try {
    const limits = await ctx.state.pricingService.getCurrencyLimitations();

    const exposedLimits: ExposedCurrencyLimitations = Object.entries(
      limits
    ).reduce((acc, [curr, limitation]) => {
      acc[curr as SupportedPaymentCurrencyTypes] = {
        ...limitation,
        zeroDecimalCurrency: zeroDecimalCurrencyTypes.includes(
          curr as SupportedPaymentCurrencyTypes
        ),
      };
      return acc;
    }, {} as ExposedCurrencyLimitations);

    ctx.body = {
      supportedCurrencies: supportedPaymentCurrencyTypes,
      limits: exposedLimits,
    };
    ctx.status = 200;
    ctx.set("Cache-Control", `max-age=${oneHourInSeconds}`);
  } catch (error) {
    ctx.body = "Fiat Oracle Unavailable";
    ctx.status = 502;
  }

  return next();
}
