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
import { Consumer, ConsumerOptions } from "sqs-consumer";

import { Architecture } from "./architecture";
import { DestinationAddressType } from "./database/dbTypes";
import { PostgresDatabase } from "./database/postgres";
import { MandrillEmailProvider } from "./emailProvider";
import { addCreditsToAddresses } from "./jobs/addCreditsToAddresses";
import { creditPendingTransactionsHandler } from "./jobs/creditPendingTx";
import globalLogger from "./logger";
import { MetricRegistry } from "./metricRegistry";
import { isValidUserAddress } from "./utils/base64";
import { loadSecretsToEnv } from "./utils/loadSecretsToEnv";
import { sendSlackMessage } from "./utils/slack";

function createConsumerQueue(
  { queueUrl, ...restOfOptions }: ConsumerOptions,
  metricOnError: () => void = () =>
    MetricRegistry.uncaughtExceptionCounter.inc(),
  consumerLogger: typeof globalLogger = globalLogger.child({ queueUrl })
) {
  const consumer = Consumer.create({
    queueUrl,
    ...restOfOptions,
  });

  consumer.on("error", (err: unknown) => {
    metricOnError();
    consumerLogger.error(`Queue consumer error: ${err}`);
  });

  consumer.on(
    "processing_error",
    (error: { message: string }, message: void | Message | Message[]) => {
      metricOnError();
      consumerLogger.error(`[SQS] PROCESSING ERROR`, error, message);
    }
  );

  consumer.on("message_received", (message: void | Message | Message[]) => {
    consumerLogger.info(`[SQS] Message received`);
    consumerLogger.debug(`[SQS] Received message contents:`, message);
  });

  consumer.on("message_processed", (message: void | Message | Message[]) => {
    consumerLogger.info(`[SQS] Message processed`);
    consumerLogger.debug(`[SQS] Processed message contents:`, message);
  });

  consumer.on("stopped", () => {
    consumerLogger.warn(`[SQS] Consumer has been STOPPED!`);
  });

  consumer.on("started", () => {
    consumerLogger.info(`[SQS] Consumer Started!`);
  });

  consumer.on("empty", () => {
    consumerLogger.debug(`[SQS] Queue is empty!`);
  });

  process.on("SIGINT", () => {
    consumerLogger.info(`[SQS] Consumer received SIGINT!`);
    consumer.stop();
  });

  return consumer;
}

function startPendingPaymentTxQueue({
  paymentDatabase,
}: Partial<Architecture>): void {
  const pendingPaymentTxQueueUrl = process.env.PENDING_PAYMENT_TX_QUEUE_URL;
  if (!pendingPaymentTxQueueUrl) {
    globalLogger.warn(`No pending payment tx queue URL found!`);
    return;
  }

  const paymentTxQueueLogger = globalLogger.child({
    queue: "pending-payment-tx",
  });

  return createConsumerQueue(
    {
      sqs: new SQSClient({ region: process.env.AWS_REGION ?? "us-east-1" }),
      queueUrl: pendingPaymentTxQueueUrl,
      // Queue is cron based, so we can afford to wait a bit on polling
      pollingWaitTimeMs: 10_000, // 10 seconds

      handleMessage: async (message: Message) => {
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
  ).start();
}

type AdminCreditToolMessageBody = {
  addresses: string[];
  creditAmount: number;
  addressType?: DestinationAddressType;
  giftMessage?: string;
};

class AdminCreditToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminCreditToolInputError";
  }
}

function startAdminCreditToolConsumer({
  emailProvider,
  paymentDatabase,
}: Partial<Architecture>): void {
  const adminCreditToolQueueUrl = process.env.ADMIN_CREDIT_TOOL_QUEUE_URL;
  if (!adminCreditToolQueueUrl) {
    globalLogger.warn(`No admin credit tool queue URL found!`);
    return;
  }

  const adminCreditToolLogger = globalLogger.child({
    queue: "admin-credit-tool",
  });

  return createConsumerQueue(
    {
      sqs: new SQSClient({ region: process.env.AWS_REGION ?? "us-east-1" }),
      queueUrl: adminCreditToolQueueUrl,
      pollingWaitTimeMs: 5_000, // 5 seconds

      handleMessage: async (message: Message) => {
        try {
          if (!message.Body) {
            throw new AdminCreditToolInputError(
              `No message body found in SQS message to run job on`
            );
          }

          const {
            addresses,
            creditAmount,
            addressType = "arweave",
            giftMessage,
          } = JSON.parse(message.Body) as AdminCreditToolMessageBody;

          if (!addresses || !creditAmount || !addresses.length) {
            throw new AdminCreditToolInputError(
              `Missing required fields in message body: \`addresses\` and \`creditAmount\``
            );
          }

          if (addressType !== "email") {
            for (const address of addresses) {
              if (!isValidUserAddress(address, addressType)) {
                throw new AdminCreditToolInputError(
                  `Invalid address for ${addressType} address type: ${address}`
                );
              }
            }
          }

          await addCreditsToAddresses({
            paymentDatabase,
            emailProvider,
            logger: adminCreditToolLogger.child({
              messageId: message.MessageId,
            }),
            addresses,
            addressType,
            creditAmount,
            giftMessage,
          });
        } catch (error) {
          await sendSlackMessage({
            message: `Error processing admin credit tool message:\n${
              error instanceof Error ? error.message : error
            }`,
            icon_emoji: ":x:",
          });

          if (error instanceof AdminCreditToolInputError) {
            adminCreditToolLogger.error(
              `Error processing admin credit tool message: ${error.message}`
            );
            // Don't rethrow input errors, delete this message from the queue
            return;
          }
          throw error;
        }
      },
    },
    () => MetricRegistry.adminCreditToolJobFailure.inc(),
    adminCreditToolLogger
  ).start();
}

export async function startConsumers(): Promise<void> {
  await loadSecretsToEnv();

  const consumerArchitecture: Partial<Architecture> = {
    paymentDatabase: new PostgresDatabase({}),
    emailProvider: process.env.MANDRILL_API_KEY
      ? new MandrillEmailProvider(process.env.MANDRILL_API_KEY)
      : undefined,
  };

  startPendingPaymentTxQueue(consumerArchitecture);
  startAdminCreditToolConsumer(consumerArchitecture);
}
