import { expect } from "chai";

import { DbTestHelper } from "../../../../tests/dbTestHelper";
import { paymentIntentStub } from "../../../../tests/helpers/stubs";
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
  const dbTestHelper = new DbTestHelper(db);

  const paymentFailedTopUpQuoteId = "Payment Failed Top Up Quote ID 😩";

  const paymentIntent = paymentIntentStub({
    top_up_quote_id: paymentFailedTopUpQuoteId,
    status: "canceled",
  });

  before(async () => {
    // Insert top up quote that success event depends on
    await dbTestHelper.insertStubTopUpQuote({
      top_up_quote_id: paymentFailedTopUpQuoteId,
    });

    // Trigger failure event happy path
    await handlePaymentFailedEvent(paymentIntent, db);
  });

  it("should capture the payment failed event and expire the top up quote", async () => {
    // Payment receipt was not created
    const paymentReceiptDbResults = await db["knex"]<PaymentReceiptDBResult>(
      tableNames.paymentReceipt
    ).where({
      top_up_quote_id: paymentFailedTopUpQuoteId,
    });
    expect(paymentReceiptDbResults).to.have.length(0);

    // Top up quote was expired
    const topUpQuoteDbResults = await db["knex"]<TopUpQuoteDBResult>(
      tableNames.topUpQuote
    ).where({
      top_up_quote_id: paymentFailedTopUpQuoteId,
    });
    expect(topUpQuoteDbResults).to.have.length(0);

    // Top up quote was expired; which means deleted and re-inserted as failed
    const failedTopUpQuoteDbResults = await db[
      "knex"
    ]<FailedTopUpQuoteDBResult>(tableNames.failedTopUpQuote).where({
      top_up_quote_id: paymentFailedTopUpQuoteId,
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

    expect(amount).to.equal("100");
    expect(currency_type).to.equal("usd");
    expect(destination_address).to.equal(
      "1234567890123456789012345678901231234567890"
    );
    expect(destination_address_type).to.equal("arweave");
    expect(payment_provider).to.equal("stripe");
    expect(quote_failed_date).to.exist;
    expect(quote_creation_date).to.exist;
    expect(quote_expiration_date).to.exist;
    expect(top_up_quote_id).to.equal(paymentFailedTopUpQuoteId);
    expect(winston_credit_amount).to.equal("1337");
  });
});
