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
import Stripe from "stripe";

export const stubTxId1 = "0000000000000000000000000000000000000000001";
export const stubTxId2 = "0000000000000000000000000000000000000000002";

interface StubPaymentIntentParams {
  id?: string;
  status?: Stripe.PaymentIntent.Status;
  currency?: string;
  amount?: number;
  payment_method?: string | Stripe.PaymentMethod | null;
  metadata?: {
    [x: string]: string;
  };
  paymentIntent?: string;
}
export const paymentIntentStub = ({
  id = "pi_123",
  status = "succeeded",
  currency = "usd",
  amount = 100,
  payment_method = "card",
  metadata = {
    topUpQuoteId: "0x1234567890",
  },
}: StubPaymentIntentParams): Stripe.PaymentIntent => {
  return {
    id,
    status,
    amount,
    currency,
    metadata,
    object: "payment_intent",
    amount_capturable: 0,
    amount_received: 0,
    application: null,
    application_fee_amount: null,
    automatic_payment_methods: null,
    canceled_at: null,
    cancellation_reason: null,
    capture_method: "automatic",
    payment_method,
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
    payment_method_options: null,
    payment_method_types: ["card"],
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
    latest_charge: null,
    payment_method_configuration_details: {
      id: "pm_1MnkNVC8apPOWkDLH9wJvENb",
      parent: "card_1MnkNVC8apPOWkDLH9wJvENb",
    },
  };
};

export const checkoutSessionStub = ({
  id = "pi_123",
  currency = "usd",
  metadata = {
    topUpQuoteId: "0x1234567890",
  },
}: StubPaymentIntentParams): Stripe.Checkout.Session => {
  return {
    id,
    metadata,
    currency,
    object: "checkout.session",
    after_expiration: null,
    allow_promotion_codes: null,
    amount_subtotal: null,
    amount_total: null,
    automatic_tax: {
      status: null,
      enabled: false,
      liability: null,
    },
    custom_text: {
      shipping_address: null,
      submit: null,
      after_submit: null,
      terms_of_service_acceptance: null,
    },
    custom_fields: [],
    customer_creation: null,
    invoice: null,
    invoice_creation: null,
    mode: "payment",
    cancel_url: null,
    client_reference_id: null,
    billing_address_collection: null,
    customer: null,
    customer_details: null,
    customer_email: null,
    expires_at: 0,
    livemode: false,
    locale: null,
    consent_collection: null,
    consent: null,
    payment_intent: null,
    created: 0,
    payment_link: null,
    payment_method_collection: null,
    payment_method_options: null,
    payment_method_types: ["card", "crypto"],
    payment_status: "paid",
    recovered_from: null,
    setup_intent: null,
    shipping_address_collection: null,
    shipping_cost: null,
    shipping_details: null,
    shipping_options: [],
    status: "complete",
    submit_type: null,
    subscription: null,
    success_url: "",
    total_details: null,
    url: null,
    client_secret: null,
    currency_conversion: null,
    payment_method_configuration_details: {
      id: "pm_1MnkNVC8apPOWkDLH9wJvENb",
      parent: "card_1MnkNVC8apPOWkDLH9wJvENb",
    },
    ui_mode: "hosted",
  };
};

export const checkoutSessionSuccessStub: Stripe.Checkout.Session =
  checkoutSessionStub({});
export const paymentIntentSucceededStub: Stripe.PaymentIntent =
  paymentIntentStub({});
export const paymentIntentFailedStub: Stripe.PaymentIntent = paymentIntentStub({
  status: "canceled",
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const stripeResponseStub: Stripe.Response<any> = (
  details: Stripe.PaymentIntent | Stripe.Checkout.Session
) => {
  return {
    lastResponse: {
      headers: {},
      requestId: "req_123",
      statusCode: 200,
    },
    ...details,
  };
};

export const chargeDisputeStub = ({
  id = "dp_1MnkNVC8apPOWkDLH9wJvENb",
  currency = "usd",
  amount = 100,
  metadata = {
    topUpQuoteId: "0x1234567890",
  },
  paymentIntent = "pi_123",
}: StubPaymentIntentParams): Stripe.Dispute => {
  return {
    id,
    object: "dispute",
    amount,
    balance_transactions: [],
    charge: "ch_3MnkNUC8apPOWkDL0j4wj3Wn",
    created: 1679325125,
    currency,
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
    metadata,
    payment_intent: paymentIntent,
    reason: "fraudulent",
    status: "warning_needs_response",
  };
};

export const stripeStubEvent = ({
  id = "evt_1NO6oXC8apPOWkDLjlNxy96d",
  eventObject,
  type,
}: {
  eventObject: Stripe.Dispute | Stripe.PaymentIntent;
  id?: string;
  type: "payment_intent.succeeded" | "charge.dispute.created";
}): Stripe.Event => {
  return {
    id,
    created: 1687991177,
    object: "event",
    data: {
      object: eventObject,
    },
    api_version: "2022-11-15",
    livemode: false,
    type: type,
    pending_webhooks: 0,
    request: null,
  } as Stripe.Event;
};

export const expectedTokenPrices = {
  arweave: {
    usd: 7.02,
    aed: 25.78,
    ars: 1604.35,
    aud: 10.36,
    bdt: 754.47,
    bmd: 7.02,
    brl: 34.72,
    cad: 9.39,
    chf: 6.25,
    clp: 5528.94,
    cny: 48.68,
    czk: 149.96,
    dkk: 47.61,
    eur: 6.39,
    gbp: 5.56,
    hkd: 54.99,
    huf: 2362.82,
    idr: 103201,
    ils: 25.61,
    inr: 575.23,
    jpy: 943.32,
    krw: 9256.61,
    lkr: 2224.06,
    mmk: 14756.72,
    mxn: 123.3,
    myr: 31.26,
    ngn: 3239.16,
    nok: 73.8,
    nzd: 11.03,
    php: 391.16,
    pkr: 1997.69,
    pln: 28.89,
    rub: 534.4,
    sar: 26.33,
    sek: 71.75,
    sgd: 9.31,
    thb: 236,
    try: 137.24,
    twd: 215.55,
    uah: 258.2,
    vnd: 164811,
    zar: 132.44,
  },
  ethereum: {
    usd: 3544.24,
    jpy: 542088,
    eur: 3300.02,
    gbp: 2827.36,
    inr: 295635,
    aud: 5446.18,
    sgd: 4799.23,
    cad: 4851.82,
    hkd: 27770,
    brl: 17961.12,
  },
  solana: {
    usd: 173.41,
    jpy: 26523,
    eur: 161.46,
    gbp: 138.33,
    inr: 14464.61,
    aud: 266.47,
    sgd: 234.81,
    cad: 237.39,
    hkd: 1358.73,
    brl: 878.79,
  },
  "kyve-network": {
    usd: 0.02336109,
    jpy: 3.43,
    eur: 0.02107705,
    gbp: 0.01798402,
    inr: 1.96,
    aud: 0.03470311,
    sgd: 0.03055981,
    cad: 0.03185612,
    hkd: 0.181921,
    brl: 0.126463,
  },
  "matic-network": {
    usd: 0.368571,
    jpy: 52.83,
    eur: 0.331564,
    gbp: 0.279491,
    inr: 30.93,
    aud: 0.546444,
    sgd: 0.478965,
    cad: 0.497505,
    hkd: 2.87,
    brl: 2.05,
  },
  "l2-standard-bridged-weth-base": {
    usd: 3544.24,
    jpy: 542088,
    eur: 3300.02,
    gbp: 2827.36,
    inr: 295635,
    aud: 5446.18,
    sgd: 4799.23,
    cad: 4851.82,
    hkd: 27770,
    brl: 17961.12,
  },
  "ar-io-network": {
    usd: 0.08,
    jpy: 52.83,
    eur: 0.331564,
    gbp: 0.279491,
    inr: 30.93,
    aud: 0.546444,
    sgd: 0.478965,
    cad: 0.497505,
    hkd: 2.87,
    brl: 2.05,
  },
};

// TODO: we could make this a function and apply it against the arweave rates above using the turboPercentageFee constant
export const expectedRates = {
  winc: "857922282166",
  fiat: {
    aud: 11.603230865848,
    brl: 38.886503442302,
    cad: 10.516827975899,
    eur: 7.156819037912,
    gbp: 6.227216565069,
    hkd: 61.5889638333,
    inr: 644.25931379941,
    jpy: 1056.521210460615,
    sgd: 10.427227737552,
    usd: 7.862420914889,
  },
};
