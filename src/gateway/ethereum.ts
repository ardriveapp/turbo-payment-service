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
import BigNumber from "bignumber.js";
import { ethers } from "ethers";

import { gatewayUrls } from "../constants";
import { PaymentTransactionNotFound } from "../database/errors";
import logger from "../logger";
import { TransactionId } from "../types";
import {
  Gateway,
  GatewayParams,
  TransactionInfo,
  TransactionStatus,
} from "./gateway";

export class EthereumGateway extends Gateway {
  public endpoint: URL;
  private provider: ethers.JsonRpcProvider;

  constructor({
    endpoint = gatewayUrls.ethereum,
    paymentTxPollingWaitTimeMs,
    pendingTxMaxAttempts,
    minConfirmations = +(process.env.ETHEREUM_MIN_CONFIRMATIONS || 5),
  }: GatewayParams = {}) {
    super({
      paymentTxPollingWaitTimeMs,
      pendingTxMaxAttempts,
      minConfirmations,
    });
    this.endpoint = endpoint;
    this.provider = new ethers.JsonRpcProvider(endpoint.toString());
  }

  public async getTransactionStatus(
    transactionId: TransactionId
  ): Promise<TransactionStatus> {
    logger.debug("Getting transaction status...", { transactionId });
    const statusResponse = await this.provider.getTransactionReceipt(
      transactionId
    );
    if (statusResponse === null) {
      logger.debug("Transaction not found...", { transactionId });
      return { status: "not found" };
    }

    if ((await statusResponse.confirmations()) >= this.minConfirmations) {
      return {
        status: "confirmed",
        blockHeight: statusResponse.blockNumber,
      };
    }

    return { status: "pending" };
  }

  public async getTransaction(
    transactionId: TransactionId
  ): Promise<TransactionInfo> {
    return this.pollGatewayForTx(async () => {
      logger.debug("Getting transaction...", { transactionId });
      const txResponse = await this.provider.getTransaction(transactionId);
      if (txResponse === null) {
        throw new PaymentTransactionNotFound(transactionId);
      }

      const tx = {
        transactionQuantity: BigNumber(txResponse.value.toString()),
        transactionSenderAddress: txResponse.from,
        transactionRecipientAddress: txResponse.to ?? "",
      };

      return tx;
    }, transactionId);
  }
}
