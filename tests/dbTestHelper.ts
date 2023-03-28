import { expect } from "chai";
import { Knex } from "knex";

import { tableNames } from "../src/database/dbConstants";
import {
  ChargebackReceiptDBInsert,
  PaymentReceiptDBInsert,
  TopUpQuoteDBInsert,
  UserAddress,
  UserDBInsert,
} from "../src/database/dbTypes";
import { PostgresDatabase } from "../src/database/postgres";

type TableNameKeys = keyof typeof tableNames;
type TableNameValues = (typeof tableNames)[TableNameKeys];

export const stubArweaveUserAddress: UserAddress =
  "1234567890123456789012345678901231234567890";

interface StubTopUpQuoteParams {
  top_up_quote_id?: string;
  quote_expiration_date?: string;
  amount?: string;
  winston_credit_amount?: string;
}

function stubTopUpQuoteInsert({
  top_up_quote_id = "The Stubbiest Top Up Quote",
  quote_expiration_date = new Date("2023-03-23 16:20:00").toISOString(),
  amount = "100",
  winston_credit_amount = "1337",
}: StubTopUpQuoteParams): TopUpQuoteDBInsert {
  return {
    amount,
    currency_type: "usd",
    destination_address: stubArweaveUserAddress,
    destination_address_type: "arweave",
    quote_expiration_date,
    payment_provider: "stripe",
    top_up_quote_id,
    winston_credit_amount,
  };
}

interface StubPaymentReceiptParams {
  payment_receipt_id?: string;
  top_up_quote_id?: string;
  destination_address?: string;
  amount?: string;
  winston_credit_amount?: string;
}

function stubPaymentReceiptInsert({
  amount = "100",
  payment_receipt_id = "The Stubbiest Payment Receipt",
  top_up_quote_id = "The Stubbiest Top Up Quote",
  destination_address = stubArweaveUserAddress,
  winston_credit_amount = "1337",
}: StubPaymentReceiptParams): PaymentReceiptDBInsert {
  return {
    amount,
    currency_type: "usd",
    destination_address,
    destination_address_type: "arweave",
    top_up_quote_id,
    payment_provider: "stripe",
    payment_receipt_id,
    winston_credit_amount,
  };
}

function stubChargebackReceiptInsert({
  chargeback_receipt_id = "The Stubbiest Chargeback Receipt",
  payment_receipt_id = "The Stubbiest Payment Receipt Id",
}: {
  chargeback_receipt_id?: string;
  payment_receipt_id?: string;
}): ChargebackReceiptDBInsert {
  return {
    amount: "100",
    currency_type: "usd",
    destination_address: stubArweaveUserAddress,
    destination_address_type: "arweave",
    payment_receipt_id,
    payment_provider: "stripe",
    chargeback_receipt_id,
    winston_credit_amount: "1337",
    chargeback_reason: "What is the reason?",
  };
}

interface StubUserParams {
  user_address?: string;
  winston_credit_balance?: string;
}

function stubUserInsert({
  user_address = "The Stubbiest User",
  winston_credit_balance = "101010101",
}: StubUserParams): UserDBInsert {
  return {
    user_address,
    user_address_type: "arweave",
    winston_credit_balance,
  };
}

export class DbTestHelper {
  constructor(public readonly db: PostgresDatabase) {}

  private get knex(): Knex {
    return this.db["knex"];
  }

  public async insertStubUser(insertParams: StubUserParams): Promise<void> {
    return this.knex(tableNames.user).insert(stubUserInsert(insertParams));
  }

  public async insertStubTopUpQuote(
    insertParams: StubTopUpQuoteParams
  ): Promise<void> {
    return this.knex(tableNames.topUpQuote).insert(
      stubTopUpQuoteInsert(insertParams)
    );
  }

  public async insertStubPaymentReceipt(
    insertParams: StubPaymentReceiptParams
  ): Promise<void> {
    return this.knex(tableNames.paymentReceipt).insert(
      stubPaymentReceiptInsert(insertParams)
    );
  }

  public async insertStubChargebackReceipt(insertParams: {
    chargeback_receipt_id?: string;
    top_up_quote_id?: string;
  }): Promise<void> {
    return this.knex(tableNames.chargebackReceipt).insert(
      stubChargebackReceiptInsert(insertParams)
    );
  }

  public async cleanUpEntityInDb(
    tableName: TableNameValues,
    pk_val: string
  ): Promise<void> {
    const pkColumnName = tableName === "user" ? "_address" : "_id";
    const where = { [`${tableName}${pkColumnName}`]: pk_val };

    await this.knex(tableName).where(where).del();
    expect((await this.knex(tableName).where(where)).length).to.equal(0);
  }
}
