import Stripe from "stripe";

interface StubPaymentIntentParams {
  id?: string;
  status?: Stripe.PaymentIntent.Status;
  topUpQuoteId?: string;
  currency?: string;
  amount?: number;
}
export const paymentIntentStub = ({
  id = "pi_123",
  status = "succeeded",
  topUpQuoteId = "0x1234567890",
  currency = "usd",
  amount = 100,
}: StubPaymentIntentParams): Stripe.PaymentIntent => {
  return {
    id,
    status,
    amount,
    currency,
    metadata: { topUpQuoteId },
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
};

export const paymentIntentSucceededStub: Stripe.PaymentIntent =
  paymentIntentStub({});
export const paymentIntentFailedStub: Stripe.PaymentIntent = paymentIntentStub({
  status: "canceled",
});

export const chargeDisputeStub: Stripe.Dispute = {
  id: "dp_1MnkNVC8apPOWkDLH9wJvENb",
  object: "dispute",
  amount: 100,
  balance_transactions: [],
  charge: "ch_3MnkNUC8apPOWkDL0j4wj3Wn",
  created: 1679325125,
  currency: "usd",
  evidence: {
    access_activity_log: null,
    billing_address: null,
    cancellation_policy: null,
    cancellation_policy_disclosure: null,
    cancellation_rebuttal: null,
    customer_communication: null,
    customer_email_address: null,
    customer_name: null,
    customer_purchase_ip: null,
    customer_signature: null,
    duplicate_charge_documentation: null,
    duplicate_charge_explanation: null,
    duplicate_charge_id: null,
    product_description: null,
    receipt: null,
    refund_policy: null,
    refund_policy_disclosure: null,
    refund_refusal_explanation: null,
    service_date: null,
    service_documentation: null,
    shipping_address: null,
    shipping_carrier: null,
    shipping_date: null,
    shipping_documentation: null,
    shipping_tracking_number: null,
    uncategorized_file: null,
    uncategorized_text: null,
  },
  evidence_details: {
    due_by: 1680134399,
    has_evidence: false,
    past_due: false,
    submission_count: 0,
  },
  is_charge_refundable: true,
  livemode: false,
  metadata: {
    topUpQuoteId: "0x1234567890",
  },
  payment_intent: null,
  reason: "fraudulent",
  status: "warning_needs_response",
};
