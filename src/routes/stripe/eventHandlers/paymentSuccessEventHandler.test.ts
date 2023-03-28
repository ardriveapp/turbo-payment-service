import { expect } from "chai";

import { DbTestHelper } from "../../../../tests/dbTestHelper";
import {
  paymentIntentStub,
  paymentIntentSucceededStub,
} from "../../../../tests/helpers/stubs";
import { tableNames } from "../../../database/dbConstants";
import { PaymentReceiptDBResult } from "../../../database/dbTypes";
import { PostgresDatabase } from "../../../database/postgres";
import { handlePaymentSuccessEvent } from "./paymentSuccessEventHandler";

describe("handlePaymentSuccessEvent", () => {
  const db = new PostgresDatabase();
  const dbTestHelper = new DbTestHelper(db);

  const paymentSuccessTopUpQuoteId = "Payment Success Top Up Quote ID 🧾";

  const paymentIntent = paymentIntentStub({
    top_up_quote_id: paymentSuccessTopUpQuoteId,
  });
  before(async () => {
    // Insert top up quote that success event depends on

    await dbTestHelper.insertStubTopUpQuote({
      top_up_quote_id: paymentSuccessTopUpQuoteId,
      winston_credit_amount: "500",
      amount: "1",
    });

    // Trigger success event happy path
    await handlePaymentSuccessEvent(paymentIntent, db);
  });

  it("should process payment and create receipt if top up quote exists", async () => {
    const paymentReceiptDbResults = await db["knex"]<PaymentReceiptDBResult>(
      tableNames.paymentReceipt
    ).where({
      top_up_quote_id: paymentSuccessTopUpQuoteId,
    });
    expect(paymentReceiptDbResults).to.have.length(1);

    const {
      amount,
      currency_type,
      destination_address,
      destination_address_type,
      payment_provider,
      payment_receipt_date,
      payment_receipt_id,
      top_up_quote_id,
      winston_credit_amount,
    } = paymentReceiptDbResults[0];

    expect(amount).to.equal("1");
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

  it("should throw an error if no top up quote is found", async () => {
    const paymentIntent = paymentIntentSucceededStub;

    try {
      await handlePaymentSuccessEvent(paymentIntent, db);
      expect.fail("No payment quote found for 0x1234567890");
    } catch (error) {
      expect(error).to.exist;
    }
  });
});
