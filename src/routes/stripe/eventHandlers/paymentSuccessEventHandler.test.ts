import * as chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { Stripe } from "stripe";

import { handlePaymentSuccessEvent } from "./paymentSuccessEventHandler";

var expect = chai.expect;
chai.use(sinonChai);

const mockPricingService = {
  getARCForFiat: () => Promise.resolve("1.2345"),
};

const mockDatabase = {
  getPaymentQuote: () => Promise.resolve({}),
  createReceipt: () => Promise.resolve({}),
};

const mockCtx = {
  architecture: {
    pricingService: mockPricingService,
    paymentDatabase: mockDatabase,
  },
};

describe("handlePaymentSuccessEvent", () => {
  afterEach(() => {
    // reset the mocks after each test
    sinon.reset();
  });

  it("should process payment and create receipt if payment quote exists", async () => {
    const paymentIntent: Stripe.PaymentIntent = {
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
    sinon.stub(mockDatabase, "getPaymentQuote").resolves({});
    sinon.stub(mockDatabase, "createReceipt").resolves({});
    sinon.stub(mockPricingService, "getARCForFiat").resolves("1.2345");

    await handlePaymentSuccessEvent(paymentIntent, mockCtx);

    expect(mockDatabase.getPaymentQuote).to.have.been.calledOnceWithExactly(
      paymentIntent.metadata["address"]
    );
    expect(mockDatabase.createReceipt).to.have.been.calledOnceWithExactly(
      paymentIntent.metadata["address"]
    );
    expect(mockPricingService.getARCForFiat).to.have.been.calledOnceWithExactly(
      paymentIntent.currency,
      paymentIntent.amount
    );
  });

  it("should throw an error if no payment quote is found", async () => {
    const paymentIntent: Stripe.PaymentIntent = {
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
    sinon.stub(mockDatabase, "getPaymentQuote").resolves(undefined);
    try {
      await handlePaymentSuccessEvent(paymentIntent, mockCtx);
      expect.fail("No payment quote found for 0x1234567890");
    } catch (error) {
      expect(error).to.exist;
    }
  });
});
