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
import { Connection as SolanaConnection } from "@solana/web3.js";
import { AxiosInstance } from "axios";
import BigNumber from "bignumber.js";
import { ethers } from "ethers";

import { createAxiosInstance } from "./axiosClient";
import {
  arweaveGatewayUrl,
  ethereumGatewayUrl,
  solanaGatewayUrl,
} from "./constants";
import { PaymentTransactionNotFound } from "./database/errors";
import logger from "./logger";
import { TransactionId } from "./types";

export const supportedPaymentTokens = [
  "arweave",
  "ethereum",
  "solana",
] as const;
export type TokenType = (typeof supportedPaymentTokens)[number];
export function isSupportedPaymentToken(token: string): token is TokenType {
  return supportedPaymentTokens.includes(token as TokenType);
}

export type GatewayMap = Record<TokenType, Gateway>;

type GatewayParams = {
  pendingTxMaxAttempts?: number;
  paymentTxPollingWaitTimeMs?: number;
  endpoint?: URL;
  minConfirmations?: number;
};

type ArweaveGatewayParams = GatewayParams & {
  axiosInstance?: AxiosInstance;
};

export type TransactionStatus =
  | { status: "confirmed"; blockHeight: number }
  | { status: "pending" | "not found" };
export type TransactionInfo = {
  transactionQuantity: BigNumber;
  transactionSenderAddress: string;
  transactionRecipientAddress: string;
};

abstract class Gateway {
  public abstract endpoint: URL;
  public abstract getTransaction(
    transactionId: TransactionId
  ): Promise<TransactionInfo>;
  public abstract getTransactionStatus(
    transactionId: TransactionId
  ): Promise<TransactionStatus>;

  protected minConfirmations: number = +(
    process.env.DEFAULT_MIN_CONFIRMATIONS || 5
  );

  // We will poll for the transaction to be  retrievable from the gateway
  // Use polling defaults from env vars
  protected paymentTxPollingWaitTimeMs = +(
    process.env.PAYMENT_TX_POLLING_WAIT_TIME_MS || 500
  );

  protected pendingTxMaxAttempts = +(
    process.env.MAX_PAYMENT_TX_POLLING_ATTEMPTS || 5
  );

  // Default wait times: 500ms, 1000ms, 2000ms, 4000ms, 8000ms
  // Total wait time: 15.5s

  constructor({
    paymentTxPollingWaitTimeMs,
    pendingTxMaxAttempts,
    minConfirmations,
  }: GatewayParams = {}) {
    if (paymentTxPollingWaitTimeMs) {
      this.paymentTxPollingWaitTimeMs = paymentTxPollingWaitTimeMs;
    }
    if (pendingTxMaxAttempts) {
      this.pendingTxMaxAttempts = pendingTxMaxAttempts;
    }
    if (minConfirmations) {
      this.minConfirmations = minConfirmations;
    }
  }

  protected async pollGatewayForTx(
    getTx: () => Promise<TransactionInfo | undefined>,
    txId: string
  ): Promise<TransactionInfo> {
    for (let i = 0; i < this.pendingTxMaxAttempts; i++) {
      try {
        const tx = await getTx();
        if (tx) {
          return tx;
        }
      } catch (error) {
        logger.error("Error getting transaction", { error });
      }

      if (i === this.pendingTxMaxAttempts - 1) {
        // Last attempt, don't wait
        break;
      }

      const exponentialDelay = this.paymentTxPollingWaitTimeMs * Math.pow(2, i);
      logger.debug("Waiting for next attempt...", {
        attempt: i,
        delay: exponentialDelay,
        txId,
        gateway: this.endpoint,
      });
      await new Promise((resolve) => setTimeout(resolve, exponentialDelay));
    }

    throw new PaymentTransactionNotFound(txId);
  }
}

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

export class ArweaveGateway extends Gateway {
  public endpoint: URL;
  private axiosInstance: AxiosInstance;
  constructor({
    endpoint = arweaveGatewayUrl,
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

    const transaction = response.data.data.transaction;

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

type EthereumGatewayParams = GatewayParams;

export class EthereumGateway extends Gateway {
  public endpoint: URL;
  private provider: ethers.JsonRpcProvider;

  constructor({
    endpoint = ethereumGatewayUrl,
    paymentTxPollingWaitTimeMs,
    pendingTxMaxAttempts,
    minConfirmations = +(process.env.ETHEREUM_MIN_CONFIRMATIONS || 5),
  }: EthereumGatewayParams = {}) {
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

export class SolanaGateway extends Gateway {
  public endpoint: URL;

  private connection: SolanaConnection;

  constructor({
    endpoint = solanaGatewayUrl,
    paymentTxPollingWaitTimeMs,
    pendingTxMaxAttempts,
  }: GatewayParams = {}) {
    super({
      paymentTxPollingWaitTimeMs,
      pendingTxMaxAttempts,
    });
    this.endpoint = endpoint;
    this.connection = new SolanaConnection(endpoint.toString());
  }

  public async getTransactionStatus(
    transactionId: TransactionId
  ): Promise<TransactionStatus> {
    logger.debug("Getting transaction status...", { transactionId });
    const txResponse = await this.connection.getTransaction(transactionId, {
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    });

    if (txResponse?.meta) {
      return {
        // SOL Tx found in finalized state means its confirmed in the given block
        status: "confirmed",
        blockHeight: txResponse.slot,
      };
    }

    // fallback to confirmed if we can't find the transaction as finalized
    const confirmedResponse = await this.connection.getTransaction(
      transactionId,
      {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      }
    );

    if (confirmedResponse?.meta) {
      return {
        // SOL Tx found in confirmed state means its pending in the given block, could still be forked
        status: "pending",
      };
    }

    return {
      // SOL Tx not found in confirmed state means its not found
      status: "not found",
    };
  }

  public async getTransaction(
    transactionId: TransactionId
  ): Promise<TransactionInfo> {
    return this.pollGatewayForTx(async () => {
      logger.debug("Getting transaction...", { transactionId });
      const txResponse = await this.connection.getTransaction(transactionId, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (txResponse === null || !txResponse.meta) {
        throw new PaymentTransactionNotFound(transactionId);
      }

      const transactionQuantity = BigNumber(
        txResponse.meta?.postBalances[1]
      ).minus(BigNumber(txResponse.meta?.preBalances[1]));

      const [senderPubKey, recipientPubKey] =
        txResponse.transaction.message.getAccountKeys().staticAccountKeys;
      const transactionSenderAddress = senderPubKey.toBase58();
      const transactionRecipientAddress = recipientPubKey.toBase58();

      return {
        transactionQuantity,
        transactionSenderAddress,
        transactionRecipientAddress,
      };
    }, transactionId);
  }
}
