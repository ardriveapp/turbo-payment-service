import { expect } from "chai";

import { paymentIntentFailedStub } from "../../../../tests/helpers/stubs";
import { tableNames } from "../../../database/dbConstants";
import {
  FailedTopUpQuoteDBResult,
  PaymentReceiptDBResult,
  TopUpQuoteDBResult,
} from "../../../database/dbTypes";
import { PostgresDatabase } from "../../../database/postgres";
import { handlePaymentFailedEvent } from "./paymentFailedEventHandler";

describe("handlePaymentFailedEvent", () => {
  const db = new PostgresDatabase();

  // TODO: Integrate with test db
  it.skip("should capture the payment failed event and create refund receipt", async () => {
    const paymentIntent = paymentIntentFailedStub;

    await handlePaymentFailedEvent(paymentIntent, db);

    // Payment receipt was not created
    const paymentReceiptDbResults = await db["knex"]<PaymentReceiptDBResult>(
      tableNames.paymentReceipt
    ).where({
      payment_receipt_id: paymentIntent.id,
    });
    expect(paymentReceiptDbResults).to.have.length(0);

    // Top up quote was expired
    const topUpQuoteDbResults = await db["knex"]<TopUpQuoteDBResult>(
      tableNames.topUpQuote
    ).where({
      // TODO: where to get top up id
      top_up_quote_id: paymentIntent.id,
    });
    expect(topUpQuoteDbResults).to.have.length(0);

    // Top up quote was marked as failed
    const failedTopUpQuoteDbResults = await db[
      "knex"
    ]<FailedTopUpQuoteDBResult>(tableNames.failedTopUpQuote).where({
      // TODO: where to get top up id
      top_up_quote_id: paymentIntent.id,
    });
    expect(failedTopUpQuoteDbResults).to.have.length(1);

    const {
      amount,
      currency_type,
      destination_address,
      destination_address_type,
      payment_provider,
      quote_creation_date,
      quote_expiration_date,
      quote_failed_date,
      top_up_quote_id,
      winston_credit_amount,
    } = failedTopUpQuoteDbResults[0];

    // TODO: Answer ? below expectations
    expect(amount).to.equal(paymentIntent.amount);
    expect(currency_type).to.equal(paymentIntent.currency);
    expect(destination_address).to.equal("?");
    expect(destination_address_type).to.equal("arweave");
    expect(payment_provider).to.equal("stripe");
    expect(quote_failed_date).to.exist;
    expect(quote_creation_date).to.exist;
    expect(quote_expiration_date).to.exist;
    expect(top_up_quote_id).to.equal("?");
    expect(winston_credit_amount).to.equal("?");
  });
});
