import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

import logger from "../logger";

export async function loadSecretsToEnv() {
  try {
    require("dotenv").config();
  } catch (error) {
    logger.error("Error loading .env file", error);
    return;
  }

  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) {
    return; // Already loaded
  }
  const stripeSecretKeyInput = {
    SecretId: "STRIPE_SECRET_KEY",
  };

  const webhookSecretInput = {
    SecretId: "STRIPE_WEBHOOK_SECRET",
  };
  const client = new SecretsManagerClient({ region: "REGION" });
  const getStripeSecretKeyCommand = new GetSecretValueCommand(
    stripeSecretKeyInput
  );
  const getWebhookSecretCommand = new GetSecretValueCommand(webhookSecretInput);

  const secretKeyResponse = await client.send(getStripeSecretKeyCommand);
  const webhookSecretResponse = await client.send(getWebhookSecretCommand);

  process.env.STRIPE_SECRET_KEY = secretKeyResponse.SecretString;
  process.env.STRIPE_WEBHOOK_SECRET = webhookSecretResponse.SecretString;
}
