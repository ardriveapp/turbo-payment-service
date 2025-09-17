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
import { AxiosInstance } from "axios";
import BigNumber from "bignumber.js";

import { createAxiosInstance } from "../axiosClient";
import { gatewayUrls } from "../constants";
import logger from "../logger";
import { TransactionId } from "../types";
import {
  Gateway,
  GatewayParams,
  TransactionInfo,
  TransactionStatus,
} from "./gateway";

export type ArweaveTransactionResponse = {
  owner: string;
  target: string;
  quantity: string;
};

export interface ArweaveTransactionStatusResponse {
  block_height: number;
  block_indep_hash: string;
  number_of_confirmations: number;
}

type ArweaveGatewayParams = GatewayParams & {
  axiosInstance?: AxiosInstance;
};

export class ArweaveGateway extends Gateway {
  public endpoint: URL;
  private axiosInstance: AxiosInstance;
  constructor({
    endpoint = gatewayUrls.arweave,
    axiosInstance = createAxiosInstance({}),
    pendingTxMaxAttempts,
    paymentTxPollingWaitTimeMs,
    minConfirmations = +(process.env.ARWEAVE_MIN_CONFIRMATIONS || 18),
  }: ArweaveGatewayParams = {}) {
    super({
      pendingTxMaxAttempts,
      paymentTxPollingWaitTimeMs,
      minConfirmations,
    });
    this.endpoint = endpoint;
    this.axiosInstance = axiosInstance;
  }

  public async getTransactionStatus(
    transactionId: TransactionId
  ): Promise<TransactionStatus> {
    logger.debug("Getting transaction status...", { transactionId });
    const statusResponse =
      await this.axiosInstance.get<ArweaveTransactionStatusResponse>(
        `${this.endpoint}tx/${transactionId}/status`,
        { validateStatus: () => true }
      );

    if (statusResponse.status === 404) {
      logger.debug("Transaction not found...", { transactionId });
      return { status: "not found" };
    }

    if (
      statusResponse?.data?.number_of_confirmations >= this.minConfirmations
    ) {
      return {
        status: "confirmed",
        blockHeight: statusResponse.data.block_height,
      };
    }

    return { status: "pending" };
  }

  public async getTransaction(
    transactionId: TransactionId
  ): Promise<TransactionInfo> {
    return this.pollGatewayForTx(
      () => this.getTxFromGql(transactionId),
      transactionId
    );
  }

  private async getTxFromGql(
    transactionId: TransactionId
  ): Promise<TransactionInfo | undefined> {
    const gqlQuery = `
    query {
      transaction(id: "${transactionId}") {
        recipient
        owner {
          address
        }
        quantity {
          winston
        }
      }
    }
  `;

    const response = await this.axiosInstance.post(`${this.endpoint}graphql`, {
      query: gqlQuery,
    });

    const transaction = response?.data?.data?.transaction;

    if (!transaction) {
      return undefined;
    }
    return {
      transactionSenderAddress: transaction.owner.address,
      transactionQuantity: BigNumber(transaction.quantity.winston),
      transactionRecipientAddress: transaction.recipient,
    };
  }
}
