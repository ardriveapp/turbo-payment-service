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

import { KoaContext } from "../server";

export const walletAddresses = {
  // cspell:disable -- Turbo Dev env defaults
  arweave:
    process.env.ARWEAVE_ADDRESS ??
    "8jNb-iG3a3XByFuZnZ_MWMQSZE0zvxPMaMMBNMYegY4",
  ethereum:
    process.env.ETHEREUM_ADDRESS ??
    "0x9B13eb5096264B12532b8C648Eba4A662b4078ce",
  solana:
    process.env.SOLANA_ADDRESS ??
    "Bg5HnSVtgHVXEGqJYWqxWad9Vrcgva9JrKw3XFSEGvaB",
  matic:
    process.env.MATIC_ADDRESS ?? "0x9B13eb5096264B12532b8C648Eba4A662b4078ce",
  kyve:
    process.env.KYVE_ADDRESS ?? "kyve18yazy0nuyvctmygxr7uhddwd5clxltmgtqgc8p",
} as const; // cspell:enable

export async function rootResponse(ctx: KoaContext, next: Next) {
  ctx.body = {
    version: "0.2.0",
    addresses: walletAddresses,
    gateway: ctx.state.gatewayMap.arweave.endpoint,
  };
  return next();
}
