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

import { KoaContext } from "../server";
import { priceBytesHandler } from "./priceBytes";
import { priceFiatHandler } from "./priceFiat";

export async function priceRoutes(ctx: KoaContext, next: Next) {
  const currency = ctx.params.currency ?? "bytes";

  const walletAddress = ctx.state.walletAddress;
  if (walletAddress) {
    // eslint-disable-next-line
    // TODO: Put any promotional info from the DB that may change pricing calculations into state
  }

  if (currency === "bytes") {
    return priceBytesHandler(ctx, next);
  } else {
    return priceFiatHandler(ctx, next);
  }
}
