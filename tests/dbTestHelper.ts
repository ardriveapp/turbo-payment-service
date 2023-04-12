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

export const stubArweaveUserAddress: UserAddress =
  "1234567890123456789012345678901231234567890";

const oneHourAgo = new Date(Date.now() - 1000 * 60 * 60).toISOString();
const oneHourFromNow = new Date(Date.now() + 1000 * 60 * 60).toISOString();

type StubTopUpQuoteParams = Partial<TopUpQuoteDBInsert>;

function stubTopUpQuoteInsert({
  top_up_quote_id = "The Stubbiest Top Up Quote",
  destination_address = stubArweaveUserAddress,
  destination_address_type = "arweave",
  payment_amount = "100",
  currency_type = "usd",
  winston_credit_amount = "1337",
  quote_expiration_date = oneHourFromNow,
  payment_provider = "stripe",
}: StubTopUpQuoteParams): TopUpQuoteDBInsert {
  return {
    top_up_quote_id,
    destination_address,
    destination_address_type,
    payment_amount,
    currency_type,
    winston_credit_amount,
    quote_expiration_date,
    payment_provider,
  };
}

type StubPaymentReceiptParams = Partial<PaymentReceiptDBInsert>;

function stubPaymentReceiptInsert(
  params: StubPaymentReceiptParams
): PaymentReceiptDBInsert {
  return {
    ...stubTopUpQuoteInsert(params),
    payment_receipt_id:
      params.payment_receipt_id ?? "The Stubbiest Payment Receipt",
    quote_creation_date: oneHourAgo,
  };
}

type StubChargebackReceiptParams = Partial<ChargebackReceiptDBInsert>;

function stubChargebackReceiptInsert(
  params: StubChargebackReceiptParams
): ChargebackReceiptDBInsert {
  return {
    ...stubPaymentReceiptInsert(params),
    chargeback_receipt_id:
      params.chargeback_receipt_id ?? "The Stubbiest Chargeback Receipt",
    chargeback_reason: params.chargeback_receipt_id ?? "What is the reason?",
    payment_receipt_date: new Date().toISOString(),
  };
}

type StubUserParams = Partial<UserDBInsert>;

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

  public async insertStubChargebackReceipt(
    insertParams: StubChargebackReceiptParams
  ): Promise<void> {
    return this.knex(tableNames.chargebackReceipt).insert(
      stubChargebackReceiptInsert(insertParams)
    );
  }
}
