import { expect } from "chai";

import { paymentIntentSucceededStub } from "../../../../tests/helpers/stubs";
import { tableNames } from "../../../database/dbConstants";
import { PaymentReceiptDBResult } from "../../../database/dbTypes";
import { PostgresDatabase } from "../../../database/postgres";
import { handlePaymentSuccessEvent } from "./paymentSuccessEventHandler";

describe("handlePaymentSuccessEvent", () => {
  const db = new PostgresDatabase();

  it("should process payment and create receipt if payment quote exists", async () => {
    const paymentIntent = paymentIntentSucceededStub;

    await handlePaymentSuccessEvent(paymentIntent, db);

    const paymentReceiptDbResults = await db["knex"]<PaymentReceiptDBResult>(
      tableNames.paymentReceipt
    ).where({
      payment_receipt_id: paymentIntent.id,
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

    // TODO: Answer ? below
    expect(amount).to.equal(paymentIntent.amount);
    expect(currency_type).to.equal(paymentIntent.currency);
    expect(destination_address).to.equal("?");
    expect(destination_address_type).to.equal("arweave");
    expect(payment_provider).to.equal("stripe");
    expect(payment_receipt_date).to.exist;
    expect(payment_receipt_id).to.equal(paymentIntent.id);
    expect(top_up_quote_id).to.equal("?");
    expect(winston_credit_amount).to.equal("?");
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
