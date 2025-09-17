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
import { Architecture } from "../architecture";
import { PostgresDatabase } from "../database/postgres";
import {
  ArweaveGateway,
  EthereumGateway,
  KyveGateway,
  MaticGateway,
  SolanaGateway,
} from "../gateway";
import { ARIOGateway } from "../gateway/ario";
import { BaseEthGateway } from "../gateway/base-eth";
import globalLogger from "../logger";
import { TurboPricingService } from "../pricing/pricing";
import { sendCryptoFundSlackMessage } from "../utils/slack";

export type CreditPendingTxParams = Partial<
  Pick<Architecture, "gatewayMap" | "paymentDatabase" | "pricingService"> & {
    logger: typeof globalLogger;
  }
>;

export const expirePendingTransactionAfterMs = 60 * 60 * 24 * 1 * 1000; // 1 day

// Run this job on a cron job to start crediting any pending transactions
export async function creditPendingTransactionsHandler({
  paymentDatabase = new PostgresDatabase(),
  pricingService = new TurboPricingService(),
  logger = globalLogger.child({ job: "credit-pending-transactions-job" }),
  gatewayMap = {
    arweave: new ArweaveGateway(),
    ario: new ARIOGateway({
      logger,
      jwk:
        process.env.ARIO_SIGNING_JWK !== undefined
          ? JSON.parse(process.env.ARIO_SIGNING_JWK)
          : undefined,
    }),
    ethereum: new EthereumGateway(),
    solana: new SolanaGateway(),
    ed25519: new SolanaGateway(),
    kyve: new KyveGateway(),
    matic: new MaticGateway(),
    pol: new MaticGateway(),
    "base-eth": new BaseEthGateway(),
  },
}: CreditPendingTxParams = {}) {
  logger.debug("Starting credit pending transactions job");

  // Get all pending tx from database
  const pendingTx = await paymentDatabase.getPendingTransactions();

  if (pendingTx.length === 0) {
    logger.debug("No pending transactions to process");
    return;
  }

  // for each tx check if tx has been confirmed
  for (const tx of pendingTx) {
    const { transactionId, tokenType, createdDate } = tx;
    try {
      const gateway = gatewayMap[tokenType];

      const txStatus = await gateway.getTransactionStatus(transactionId);
      if (txStatus.status === "confirmed") {
        logger.info(
          `Transaction ${transactionId} has been confirmed, moving to credited tx`,
          { txStatus }
        );

        await sendCryptoFundSlackMessage({
          ...tx,
          usdEquivalent: await pricingService.getUsdPriceForCryptoAmount({
            amount: tx.transactionQuantity,
            token: tx.tokenType,
          }),
        });

        await paymentDatabase.creditPendingTransaction(
          transactionId,
          txStatus.blockHeight
        );
      } else if (
        txStatus.status === "not found" &&
        new Date(createdDate) <
          new Date(Date.now() - expirePendingTransactionAfterMs)
      ) {
        logger.warn(
          `Transaction ${transactionId} not found and expired, failing transaction`,
          { txStatus }
        );
        await paymentDatabase.failPendingTransaction(
          transactionId,
          "not_found"
        );
      } else {
        logger.debug(`Transaction ${transactionId} is still pending`);
      }
    } catch (error) {
      logger.error("Error processing pending transaction", { error });
    }
  }
}
