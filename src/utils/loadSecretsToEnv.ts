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
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { config } from "dotenv";

import logger from "../logger";

const stripeWebhookSecretName = "stripe-webhook-secret";
const stripeSecretKeyName = "stripe-secret-key";
const privateRouteSecretName = "private-route-secret";
const jwtSecretName = "jwt-secret";
const dbPasswordSecretName = "payment-db-password";
const wincSubsidizedPercentageParamName =
  "/payment-service/subsidized-winc-percentage";
const mandrillApiKeySecretName = "mandrill-api-key";
const slackOathTokenParamName = "slack-oauth-token";

export async function loadSecretsToEnv() {
  try {
    config();
  } catch (error) {
    logger.error("Error loading .env file", error);
    return;
  }

  if (!["dev", "prod"].includes(process.env.NODE_ENV ?? "")) {
    // Only get AWS secrets in dev or prod environments
    return;
  }

  const secretManagerClient = new SecretsManagerClient({
    region: process.env.AWS_REGION ?? "us-east-1",
  });

  const getSecretValueCommand = async (SecretId: string) => {
    return (
      await secretManagerClient.send(
        new GetSecretValueCommand({
          SecretId,
        })
      )
    ).SecretString;
  };

  const SSMParameterClient = new SSMClient({
    region: process.env.AWS_REGION ?? "us-east-1",
  });

  const getSSMParameterCommand = async (Name: string) => {
    logger.debug("Getting SSM parameter", { Name });
    return (
      await SSMParameterClient.send(
        new GetParameterCommand({
          Name,
        })
      )
    ).Parameter?.Value;
  };

  process.env.STRIPE_SECRET_KEY ??= await getSecretValueCommand(
    stripeSecretKeyName
  );
  process.env.STRIPE_WEBHOOK_SECRET ??= await getSecretValueCommand(
    stripeWebhookSecretName
  );
  process.env.PRIVATE_ROUTE_SECRET ??= await getSecretValueCommand(
    privateRouteSecretName
  );
  process.env.JWT_SECRET ??= await getSecretValueCommand(jwtSecretName);
  process.env.DB_PASSWORD ??= await getSecretValueCommand(dbPasswordSecretName);
  process.env.MANDRILL_API_KEY ??= await getSecretValueCommand(
    mandrillApiKeySecretName
  );

  process.env.SUBSIDIZED_WINC_PERCENTAGE ??= await getSSMParameterCommand(
    wincSubsidizedPercentageParamName
  );

  process.env.SLACK_OAUTH_TOKEN ??= await getSSMParameterCommand(
    slackOathTokenParamName
  );
}
