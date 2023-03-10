import { Next } from "koa";
import * as promClient from "prom-client";
import getRawBody from "raw-body";
import { Stripe } from "stripe";

import logger from "../logger";
import { KoaContext } from "../server";

require("dotenv").config();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
  appInfo: {
    // For sample support and debugging, not required for production:
    name: "ardrive-turbo",
    version: "0.0.0",
  },
  typescript: true,
});

export async function stripeRoute(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });
  //get the webhook signature for verification
  const sig = ctx.request.headers["stripe-signature"] as string;
  const rawBody = await getRawBody(ctx.req);

  const paymentSuccessCounter = new promClient.Counter({
    name: "payment_intent_succeeded",
    help: "payment_intent_succeeded",
  });

  const paymentFailedCounter = new promClient.Counter({
    name: "payment_intent_failed",
    help: "payment_intent_failed",
  });

  const topUpsCounter = new promClient.Counter({
    name: "top_ups",
    help: "top_ups",
  });

  let event;

  try {
    logger.info("Verifying webhook signature...");

    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (err: any) {
    console.log(`⚠️ Webhook signature verification failed.`);
    console.log(err.message);
    ctx.status = 400;
    ctx.response.body = `Webhook Error: ${err.message}`;
    return;
  }

  // Extract the data from the event.
  const data: Stripe.Event.Data = event.data;

  switch (event.type) {
    case "payment_intent.succeeded":
      // Cast the event into a PaymentIntent to make use of the types.
      const pi: Stripe.PaymentIntent = data.object as Stripe.PaymentIntent;
      // Funds have been captured
      // Fulfill any orders, e-mail receipts, etc
      console.log(`🔔  Webhook received: ${pi.object} ${pi.status}!`);
      console.log("💰 Payment captured!");
      paymentSuccessCounter.inc();
      topUpsCounter.inc(pi.amount);
      ctx.status = 200;
      return next;
    case "payment_intent.payment_failed":
      console.log("💸 Payment failed.");
      paymentFailedCounter.inc();
      ctx.status = 500;
      return next;
    case "payment_method.created":
      console.log("PaymentMethod was created!");
      break;
    case "payment_method.attached":
      console.log("PaymentMethod was attached to a Customer!");
      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
      ctx.status = 404;
      ctx.response.body = `Webhook Error: ${event.type}`;
      return;
  }

  return next;
}
