import { expect } from "chai";
import { stub } from "sinon";
import Stripe from "stripe";

import { DbTestHelper } from "../../../../tests/dbTestHelper";
import { paymentIntentStub } from "../../../../tests/helpers/stubs";
import { tableNames } from "../../../database/dbConstants";
import { PaymentReceiptDBResult } from "../../../database/dbTypes";
import { PostgresDatabase } from "../../../database/postgres";
import { handlePaymentSuccessEvent } from "./paymentSuccessEventHandler";

describe("handlePaymentSuccessEvent", () => {
  const db = new PostgresDatabase();
  const dbTestHelper = new DbTestHelper(db);
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2022-11-15",
  });

  const paymentSuccessTopUpQuoteId = "Payment Success Top Up Quote ID 🧾";

  const paymentIntent = paymentIntentStub({
    topUpQuoteId: paymentSuccessTopUpQuoteId,
  });

  before(async () => {
    // Insert top up quote that success event depends on
    await dbTestHelper.insertStubTopUpQuote({
      top_up_quote_id: paymentSuccessTopUpQuoteId,
      winston_credit_amount: "500",
      payment_amount: "100",
    });

    // Trigger success event happy path
    await handlePaymentSuccessEvent(paymentIntent, db, stripe);
  });

  it("should process payment and create receipt if top up quote exists", async () => {
    const paymentReceiptDbResults = await db["knex"]<PaymentReceiptDBResult>(
      tableNames.paymentReceipt
    ).where({
      top_up_quote_id: paymentSuccessTopUpQuoteId,
    });
    expect(paymentReceiptDbResults).to.have.length(1);

    const {
      payment_amount,
      currency_type,
      destination_address,
      destination_address_type,
      payment_provider,
      payment_receipt_date,
      payment_receipt_id,
      top_up_quote_id,
      winston_credit_amount,
    } = paymentReceiptDbResults[0];

    expect(payment_amount).to.equal("100");
    expect(currency_type).to.equal("usd");
    expect(destination_address).to.equal(
      "1234567890123456789012345678901231234567890"
    );
    expect(destination_address_type).to.equal("arweave");
    expect(payment_provider).to.equal("stripe");
    expect(payment_receipt_date).to.exist;
    expect(payment_receipt_id).to.exist;
    expect(top_up_quote_id).to.equal(paymentSuccessTopUpQuoteId);
    expect(winston_credit_amount).to.equal("500");
  });

  it("should attempt to refund the payment with Stripe if no top up quote is found", async () => {
    const stripeRefundSpy = stub(stripe.refunds, "create").resolves();
    const paymentIntent = paymentIntentStub({ topUpQuoteId: "nope!" });

    await handlePaymentSuccessEvent(paymentIntent, db, stripe);

    expect(stripeRefundSpy.calledOnce).to.be.true;
  });

  it("should attempt to refund the payment with Stripe if top up quote ID does not exist", async () => {
    const stripeRefundSpy = stub(stripe.refunds, "create").resolves();
    const paymentIntent = paymentIntentStub({});
    delete paymentIntent.metadata.topUpQuoteId;

    await handlePaymentSuccessEvent(paymentIntent, db, stripe);

    expect(stripeRefundSpy.calledOnce).to.be.true;
  });

  it("should attempt to refund the payment with Stripe if top up quote has been expired", async () => {
    const sixMinutesAgo = new Date(Date.now() - 1000 * 60 * 6).toISOString();
    await dbTestHelper.insertStubTopUpQuote({
      top_up_quote_id: "this is expired",
      quote_expiration_date: sixMinutesAgo,
    });

    const stripeRefundSpy = stub(stripe.refunds, "create").resolves();
    const paymentIntent = paymentIntentStub({
      topUpQuoteId: "this is expired",
    });

    await handlePaymentSuccessEvent(paymentIntent, db, stripe);

    expect(stripeRefundSpy.calledOnce).to.be.true;
  });

  it("should attempt to refund the payment with Stripe if currency type is mismatched", async () => {
    await dbTestHelper.insertStubTopUpQuote({
      top_up_quote_id: "this is wrong currency type",
      currency_type: "jpy",
      payment_amount: "500",
    });

    const stripeRefundSpy = stub(stripe.refunds, "create").resolves();
    const paymentIntent = paymentIntentStub({
      topUpQuoteId: "this is wrong currency type",
      currency: "gbp",
      amount: 500,
    });

    await handlePaymentSuccessEvent(paymentIntent, db, stripe);

    expect(stripeRefundSpy.calledOnce).to.be.true;
  });

  it("should attempt to refund the payment with Stripe if payment amount is below the quoted amount", async () => {
    await dbTestHelper.insertStubTopUpQuote({
      top_up_quote_id: "this is wrong payment amount",
      currency_type: "usd",
      payment_amount: "10101",
    });

    const stripeRefundSpy = stub(stripe.refunds, "create").resolves();
    const paymentIntent = paymentIntentStub({
      topUpQuoteId: "this is wrong payment amount",
      currency: "usd",
      amount: 10100,
    });

    await handlePaymentSuccessEvent(paymentIntent, db, stripe);

    expect(stripeRefundSpy.calledOnce).to.be.true;
  });

  it("should process the payment and create the receipt if payment amount is above the quoted amount", async () => {
    const paymentWithTaxTopUpQuoteId =
      "this is a payment with state sales tax like from NJ";

    await dbTestHelper.insertStubTopUpQuote({
      top_up_quote_id: paymentWithTaxTopUpQuoteId,
      currency_type: "usd",
      payment_amount: "10100",
    });

    const stripeRefundSpy = stub(stripe.refunds, "create").resolves();
    const paymentIntent = paymentIntentStub({
      topUpQuoteId: paymentWithTaxTopUpQuoteId,
      currency: "usd",
      amount: 10731,
    });

    await handlePaymentSuccessEvent(paymentIntent, db, stripe);

    const paymentReceiptDbResults = await db["knex"]<PaymentReceiptDBResult>(
      tableNames.paymentReceipt
    ).where({
      top_up_quote_id: paymentWithTaxTopUpQuoteId,
    });
    expect(paymentReceiptDbResults).to.have.length(1);

    const {
      payment_amount,
      currency_type,
      destination_address,
      destination_address_type,
      payment_provider,
      payment_receipt_date,
      payment_receipt_id,
      top_up_quote_id,
      winston_credit_amount,
    } = paymentReceiptDbResults[0];

    expect(payment_amount).to.equal("10100");
    expect(currency_type).to.equal("usd");
    expect(destination_address).to.equal(
      "1234567890123456789012345678901231234567890"
    );
    expect(destination_address_type).to.equal("arweave");
    expect(payment_provider).to.equal("stripe");
    expect(payment_receipt_date).to.exist;
    expect(payment_receipt_id).to.exist;
    expect(top_up_quote_id).to.equal(paymentWithTaxTopUpQuoteId);
    expect(winston_credit_amount).to.equal("1337");

    expect(stripeRefundSpy.calledOnce).to.be.false;
  });
});
