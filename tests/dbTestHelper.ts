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
import { Knex } from "knex";

import { tableNames } from "../src/database/dbConstants";
import {
  ChargebackReceiptDBInsert,
  PaymentAdjustmentDBInsert,
  PaymentAdjustmentDBResult,
  PaymentReceiptDBInsert,
  TopUpQuoteDBInsert,
  UserAddress,
  UserDBInsert,
} from "../src/database/dbTypes";
import { PostgresDatabase } from "../src/database/postgres";

export const stubArweaveUserAddress: UserAddress =
  "1234567890123456789012345678901231234567890";

export const oneHourAgo = new Date(Date.now() - 1000 * 60 * 60).toISOString();
export const oneHourFromNow = new Date(
  Date.now() + 1000 * 60 * 60
).toISOString();

type StubTopUpQuoteParams = Partial<TopUpQuoteDBInsert>;

function stubTopUpQuoteInsert({
  top_up_quote_id = "The Stubbiest Top Up Quote",
  destination_address = stubArweaveUserAddress,
  destination_address_type = "arweave",
  payment_amount = "100",
  quoted_payment_amount = "150",
  currency_type = "usd",
  winston_credit_amount = "1337",
  quote_expiration_date = oneHourFromNow,
  payment_provider = "stripe",
  gift_message,
}: StubTopUpQuoteParams): TopUpQuoteDBInsert {
  return {
    top_up_quote_id,
    destination_address,
    destination_address_type,
    payment_amount,
    quoted_payment_amount,
    currency_type,
    winston_credit_amount,
    quote_expiration_date,
    payment_provider,
    gift_message,
  };
}

type StubPaymentAdjustmentParams = Partial<PaymentAdjustmentDBResult>;

function stubPaymentAdjustmentInsert({
  adjusted_currency_type = "usd",
  adjusted_payment_amount = "100",
  adjustment_index = 0,
  catalog_id = "The Stubbiest Catalog",
  top_up_quote_id = "The Stubbiest Top Up Quote",
  user_address = stubArweaveUserAddress,
}: StubPaymentAdjustmentParams): PaymentAdjustmentDBInsert {
  return {
    adjusted_currency_type,
    adjusted_payment_amount,
    adjustment_index,
    catalog_id,
    top_up_quote_id,
    user_address,
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
    return this.db["writer"];
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

  public async insertStubPaymentAdjustment(
    insertParams: StubPaymentAdjustmentParams
  ): Promise<void> {
    return this.knex(tableNames.paymentAdjustment).insert(
      stubPaymentAdjustmentInsert(insertParams)
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
