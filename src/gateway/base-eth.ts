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
import { gatewayUrls } from "../constants";
import { EthereumGateway } from "./ethereum";
import { GatewayParams } from "./gateway";

export class BaseEthGateway extends EthereumGateway {
  constructor({
    endpoint = gatewayUrls["base-eth"],
    paymentTxPollingWaitTimeMs,
    pendingTxMaxAttempts,
    minConfirmations = +(process.env.BASE_ETH_MIN_CONFIRMATIONS || 5),
  }: GatewayParams = {}) {
    super({
      paymentTxPollingWaitTimeMs,
      pendingTxMaxAttempts,
      minConfirmations,
      endpoint,
    });
  }
}
