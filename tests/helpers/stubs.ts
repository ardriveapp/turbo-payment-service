import Stripe from "stripe";

export const paymentIntentStub: Stripe.PaymentIntent = {
  id: "pi_123",
  status: "succeeded",
  amount: 100,
  currency: "usd",
  metadata: { address: "0x1234567890" },
  object: "payment_intent",
  amount_capturable: 0,
  amount_received: 0,
  application: null,
  application_fee_amount: null,
  automatic_payment_methods: null,
  canceled_at: null,
  cancellation_reason: null,
  capture_method: "automatic",
  client_secret: null,
  confirmation_method: "automatic",
  created: 0,
  customer: null,
  description: null,
  invoice: null,
  last_payment_error: null,
  livemode: false,
  next_action: null,
  on_behalf_of: null,
  payment_method: null,
  payment_method_options: null,
  payment_method_types: [],
  processing: null,
  receipt_email: null,
  review: null,
  setup_future_usage: null,
  shipping: null,
  source: null,
  statement_descriptor: null,
  statement_descriptor_suffix: null,
  transfer_data: null,
  transfer_group: null,
};


