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

import {
  PaymentTransactionNotFound,
  PaymentTransactionNotMined,
  TransactionNotAPaymentTransaction,
} from "../database/errors";
import logger from "../logger";
import { TokenType, TransactionId } from "../types";
import { ARIOGateway } from "./ario";

export type GatewayMap = Record<TokenType, Gateway> & {
  ario: ARIOGateway;
};

export type GatewayParams = {
  pendingTxMaxAttempts?: number;
  paymentTxPollingWaitTimeMs?: number;
  endpoint?: URL;
  minConfirmations?: number;
};

export type TransactionStatus =
  | { status: "confirmed"; blockHeight: number }
  | { status: "pending" | "not found" };
export type TransactionInfo = {
  transactionQuantity: BigNumber;
  transactionSenderAddress: string;
  transactionRecipientAddress: string;
};

export abstract class Gateway {
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
        if (
          error instanceof TransactionNotAPaymentTransaction ||
          error instanceof PaymentTransactionNotMined
        ) {
          throw error;
        }
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
