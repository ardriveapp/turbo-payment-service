import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

import logger from "../logger";

const stripeWebhookSecretName = "stripe-webhook-secret";
const stripeSecretKeyName = "stripe-secret-key";
const privateRouteSecretName = "private-route-secret";
const jwtSecretName = "jwt-secret";

export async function loadSecretsToEnv() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("dotenv").config();
  } catch (error) {
    logger.error("Error loading .env file", error);
    return;
  }

  if (
    !process.env.NODE_ENV ||
    !["dev", "prod"].includes(process.env.NODE_ENV)
  ) {
    // Only get AWS secrets in dev or prod environments
    return;
  }

  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION ?? "us-east-1",
  });

  const getSecretValueCommand = (SecretId: string) =>
    new GetSecretValueCommand({
      SecretId,
    });

  process.env.STRIPE_SECRET_KEY ??= (
    await client.send(getSecretValueCommand(stripeSecretKeyName))
  ).SecretString;
  process.env.STRIPE_WEBHOOK_SECRET ??= (
    await client.send(getSecretValueCommand(stripeWebhookSecretName))
  ).SecretString;
  process.env.PRIVATE_ROUTE_SECRET ??= (
    await client.send(getSecretValueCommand(privateRouteSecretName))
  ).SecretString;
  process.env.JWT_SECRET ??= (
    await client.send(getSecretValueCommand(jwtSecretName))
  ).SecretString;
}
