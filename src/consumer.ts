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
import { Message } from "@aws-sdk/client-sqs";
import { Consumer, ConsumerOptions } from "sqs-consumer";

import globalLogger from "./logger";
import { MetricRegistry } from "./metricRegistry";

export function createConsumerQueue(
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
