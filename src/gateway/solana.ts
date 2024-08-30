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
import BigNumber from "bignumber.js";

import { solanaGatewayUrl } from "../constants";
import { PaymentTransactionNotFound } from "../database/errors";
import logger from "../logger";
import { TransactionId } from "../types";
import {
  Gateway,
  GatewayParams,
  TransactionInfo,
  TransactionStatus,
} from "./gateway";

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
