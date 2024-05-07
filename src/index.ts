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
import { Message, SQSClient } from "@aws-sdk/client-sqs";

import { createConsumerQueue } from "./consumer";
import { PostgresDatabase } from "./database/postgres";
import { creditPendingTransactionsHandler } from "./jobs/creditPendingTx";
import globalLogger from "./logger";
import { MetricRegistry } from "./metricRegistry";
import { createServer } from "./server";
import { loadSecretsToEnv } from "./utils/loadSecretsToEnv";

// Here is our server 🙌
createServer({}).catch((e) => {
  globalLogger.error(`Exiting with error: ${e}`);
  process.exit(1);
});

async function startPendingPaymentTxQueue(): Promise<void> {
  const pendingPaymentTxQueueUrl = process.env.PENDING_PAYMENT_TX_QUEUE_URL;
  if (pendingPaymentTxQueueUrl) {
    const paymentTxQueueLogger = globalLogger.child({
      queue: "pending-payment-tx",
    });

    await loadSecretsToEnv();

    const paymentDatabase = new PostgresDatabase({
      logger: paymentTxQueueLogger,
    });

    // Here is our consumer 🙌
    const consumer = createConsumerQueue(
      {
        sqs: new SQSClient({ region: process.env.AWS_REGION ?? "us-east-1" }),
        queueUrl: pendingPaymentTxQueueUrl,
        // Queue is cron based, so we can afford to wait a bit on polling
        pollingWaitTimeMs: 10_000, // 10 seconds

        handleMessage: async (message: Message) => {
          paymentTxQueueLogger.debug(`Received message`, { message });

          await creditPendingTransactionsHandler({
            logger: paymentTxQueueLogger.child({
              messageId: message.MessageId,
            }),
            paymentDatabase,
          });
          return;
        },
      },
      () => MetricRegistry.creditPendingTxJobFailure.inc(),
      paymentTxQueueLogger
    );

    consumer.start();
  } else {
    globalLogger.warn(`No pending payment tx queue URL found!`);
  }
}

startPendingPaymentTxQueue().catch((e) => {
  globalLogger.error(`Pending payment tx queue failed to start: ${e}`);
});
