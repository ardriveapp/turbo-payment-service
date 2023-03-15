import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

require("dotenv").config();

export class SecretManager {
  private STRIPE_SECRET_KEY: string | undefined;
  private STRIPE_WEBHOOK_SECRET: string | undefined;

  public getStripeSecretKey(): String {
    try {
      return this.STRIPE_SECRET_KEY!;
    } catch (error) {
      throw new Error("STRIPE_SECRET_KEY not found!");
    }
  }

  public getStripeWebhookSecret() {
    try {
      return this.STRIPE_WEBHOOK_SECRET!;
    } catch (error) {
      throw new Error("STRIPE_WEBHOOK_SECRET not found!");
    }
  }

  constructor() {
    if (process.env.STRIPE_SECRET_KEY && process.env.WEBHOOK_SECRET) {
      this.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
      this.STRIPE_WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
    } else {
      this.getSecretsFromAWS();
    }
  }

  private async getSecretsFromAWS() {
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
    const getWebhookSecretCommand = new GetSecretValueCommand(
      webhookSecretInput
    );

    const secretKeyResponse = await client.send(getStripeSecretKeyCommand);
    const webhookSecretResponse = await client.send(getWebhookSecretCommand);

    this.STRIPE_SECRET_KEY = secretKeyResponse.SecretString;
    this.STRIPE_WEBHOOK_SECRET = webhookSecretResponse.SecretString;
  }
}
