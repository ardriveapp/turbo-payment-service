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

// cspell:disable -- Turbo Dev env defaults
const defaultArAddress = "8jNb-iG3a3XByFuZnZ_MWMQSZE0zvxPMaMMBNMYegY4";
const defaultArioAddress = "NlQZT84j3RXav1Y9WRKZWd360D51os3PXH3aDDFTqjk";
const defaultEthAddress = "0x9B13eb5096264B12532b8C648Eba4A662b4078ce";
const defaultSolAddress = "Bg5HnSVtgHVXEGqJYWqxWad9Vrcgva9JrKw3XFSEGvaB";
const defaultKyveAddress = "kyve18yazy0nuyvctmygxr7uhddwd5clxltmgtqgc8p"; // cspell:enable

export const walletAddresses = {
  arweave: process.env.ARWEAVE_ADDRESS ?? defaultArAddress,
  ario: process.env.ARIO_ADDRESS ?? defaultArioAddress,
  ethereum: process.env.ETHEREUM_ADDRESS ?? defaultEthAddress,
  solana: process.env.SOLANA_ADDRESS ?? defaultSolAddress,
  ed25519: process.env.SOLANA_ADDRESS ?? defaultSolAddress,
  matic: process.env.MATIC_ADDRESS ?? defaultEthAddress,
  pol: process.env.MATIC_ADDRESS ?? defaultEthAddress,
  "base-eth": process.env.BASE_ETH_ADDRESS ?? defaultEthAddress,
  kyve: process.env.KYVE_ADDRESS ?? defaultKyveAddress,
} as const;

export async function rootResponse(ctx: KoaContext, next: Next) {
  ctx.body = {
    version: "0.2.0",
    addresses: walletAddresses,
    gateway: ctx.state.gatewayMap.arweave.endpoint,
  };
  return next();
}
