import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

import logger from "../logger";

const stripeWebhookSecretName = "stripe-webhook-secret";
const stripeSecretKeyName = "stripe-secret-key";

export async function loadSecretsToEnv() {
  try {
    require("dotenv").config();
  } catch (error) {
    logger.error("Error loading .env file", error);
    return;
  }

  if (process.env.NODE_ENV === "test") {
    // TODO - Just return for now until we handle more secrets
    return;
  }

  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) {
    return; // Already loaded
  }

  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION ?? "us-east-1",
  });

  const getStripeSecretKeyCommand = new GetSecretValueCommand({
    SecretId: stripeSecretKeyName,
  });
  const getWebhookSecretCommand = new GetSecretValueCommand({
    SecretId: stripeWebhookSecretName,
  });

  process.env.STRIPE_SECRET_KEY ??= (
    await client.send(getStripeSecretKeyCommand)
  ).SecretString;
  process.env.STRIPE_WEBHOOK_SECRET ??= (
    await client.send(getWebhookSecretCommand)
  ).SecretString;
}
