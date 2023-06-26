import { expect } from "chai";

import { DbTestHelper } from "../../../../tests/dbTestHelper";
import { chargeDisputeStub } from "../../../../tests/helpers/stubs";
import { tableNames } from "../../../database/dbConstants";
import {
  ChargebackReceiptDBResult,
  UserDBResult,
} from "../../../database/dbTypes";
import { PostgresDatabase } from "../../../database/postgres";
import { handleDisputeCreatedEvent } from "./disputeCreatedEventHandler";

describe("handleDisputeCreatedEvent", () => {
  const db = new PostgresDatabase();
  const dbTestHelper = new DbTestHelper(db);

  const disputeEventPaymentReceiptId = "A Payment Receipt Id to Dispute 👊🏻";
  const disputeEventUserAddress = "User Address to Dispute 🤺";

  const dispute = chargeDisputeStub({});

  before(async () => {
    // Insert payment receipt and user that dispute event depends on
    await dbTestHelper.insertStubUser({
      user_address: disputeEventUserAddress,
      winston_credit_balance: "1000",
    });
    await dbTestHelper.insertStubPaymentReceipt({
      payment_receipt_id: disputeEventPaymentReceiptId,
      winston_credit_amount: "50",
      top_up_quote_id: "0x1234567890",
      destination_address: disputeEventUserAddress,
    });

    // Trigger dispute event happy path
    await handleDisputeCreatedEvent(dispute, db);
  });

  it("should capture the dispute created event, decrement the user's balance, and create a chargeback receipt", async () => {
    const chargebackReceipt = await db["knexWriter"]<ChargebackReceiptDBResult>(
      tableNames.chargebackReceipt
    ).where({ payment_receipt_id: disputeEventPaymentReceiptId });
    expect(chargebackReceipt.length).to.equal(1);

    const {
      payment_amount,
      currency_type,
      destination_address,
      destination_address_type,
      payment_provider,
      chargeback_receipt_date,
      chargeback_receipt_id,
      payment_receipt_id,
      winston_credit_amount,
      chargeback_reason,
    } = chargebackReceipt[0];

    expect(payment_amount).to.equal("100");
    expect(currency_type).to.equal("usd");
    expect(destination_address).to.equal(disputeEventUserAddress);
    expect(destination_address_type).to.equal("arweave");
    expect(payment_provider).to.equal("stripe");
    expect(chargeback_receipt_date).to.exist;
    expect(chargeback_receipt_id).to.exist;
    expect(payment_receipt_id).to.equal(disputeEventPaymentReceiptId);
    expect(winston_credit_amount).to.equal("50");
    expect(chargeback_reason).to.equal("fraudulent");

    const user = await db["knexWriter"]<UserDBResult>(tableNames.user).where({
      user_address: disputeEventUserAddress,
    });

    expect(user[0].winston_credit_balance).to.equal("950");
  });
});
