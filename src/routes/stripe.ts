import { Next } from "koa";
import { Stripe } from "stripe";

import logger from "../logger";
import { KoaContext } from "../server";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? "TEST SECRET KEY";

const stripe = new Stripe(stripeSecretKey, {
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
  if (
    !ctx.req.headers["stripe-signature"] &&
    typeof ctx.req.headers["stripe-signature"] !== "string"
  ) {
    console.log(`⚠️  Cannot authorize from stripe signature.`);
    ctx.status = 400;
    return;
  }
  const signature: string = ctx.req.headers["stripe-signature"] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      ctx.request.body,
      signature,
      stripeSecretKey
    );
  } catch (err) {
    console.log(`⚠️  Webhook signature verification failed.`);
    ctx.status = 400;
    return;
  }

  // Extract the data from the event.
  const data: Stripe.Event.Data = event.data;
  const eventType: string = event.type;

  if (eventType === "payment_intent.succeeded") {
    // Cast the event into a PaymentIntent to make use of the types.
    const pi: Stripe.PaymentIntent = data.object as Stripe.PaymentIntent;
    // Funds have been captured
    // Fulfill any orders, e-mail receipts, etc
    // To cancel the payment after capture you will need to issue a Refund (https://stripe.com/docs/api/refunds).
    console.log(`🔔  Webhook received: ${pi.object} ${pi.status}!`);
    console.log("💰 Payment captured!");
  } else if (eventType === "payment_intent.payment_failed") {
    // Cast the event into a PaymentIntent to make use of the types.
    const pi: Stripe.PaymentIntent = data.object as Stripe.PaymentIntent;
    console.log(`🔔  Webhook received: ${pi.object} ${pi.status}!`);
    console.log("❌ Payment failed.");
  }

  ctx.body = "OK";
  return next;
}
