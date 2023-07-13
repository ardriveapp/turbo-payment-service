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

const wincSubsidizedPercentageParamName = "winc-subsidized-percentage";

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

  process.env.SUBSIDIZED_WINC_PERCENTAGE ??= await getSSMParameterCommand(
    wincSubsidizedPercentageParamName
  );
}
