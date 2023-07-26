/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
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

import { Adjustment } from "../../src/database/dbTypes";

export const stubTxId1 = "0000000000000000000000000000000000000000001";

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
    },
    custom_text: {
      shipping_address: null,
      submit: null,
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
    payment_method_types: ["card"],
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
  };
};

export const checkoutSessionSuccessStub: Stripe.Checkout.Session =
  checkoutSessionStub({});
export const paymentIntentSucceededStub: Stripe.PaymentIntent =
  paymentIntentStub({});
export const paymentIntentFailedStub: Stripe.PaymentIntent = paymentIntentStub({
  status: "canceled",
});

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
  type: string;
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
  };
};

export const expectedArPrices = {
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
};

export const expectedAdjustments: Adjustment[] = [
  {
    name: "FWD Research July 2023 Subsidy",
    description: "A 0% discount for uploads over 500KiB",
    value: 0,
    operator: "multiply",
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error : Winston type is stringified into "0" on API response
    adjustmentAmount: "0",
  },
];

export const expectedRates = {
  winc: "857922282166",
  fiat: {
    aud: 10.93233205718397,
    brl: 36.638085813267686,
    cad: 9.908744982331742,
    eur: 6.743011761139201,
    gbp: 5.8671589032756595,
    hkd: 58.02788994445884,
    inr: 607.008240275528,
    jpy: 995.4331540717822,
    sgd: 9.82432542976695,
    usd: 7.407815737590149,
  },
};
