/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
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
import { randomUUID } from "crypto";
import { Knex } from "knex";

import { tableNames } from "../src/database/dbConstants";
import {
  ArNSPurchaseDBInsert,
  ArNSPurchaseQuoteDBInsert,
  ChargebackReceiptDBInsert,
  DelegatedPaymentApprovalDBInsert,
  DelegatedPaymentApprovalDBResult,
  FailedArNSPurchaseDBInsert,
  PaymentAdjustmentDBInsert,
  PaymentAdjustmentDBResult,
  PaymentReceiptDBInsert,
  PendingPaymentTransactionDBInsert,
  PendingPaymentTransactionDBResult,
  TopUpQuoteDBInsert,
  UserAddress,
  UserDBInsert,
} from "../src/database/dbTypes";
import { PostgresDatabase } from "../src/database/postgres";
import { stubTxId1 } from "./helpers/stubs";

export const arweaveTxIdStringLength = 43;
export function randomCharString(length = arweaveTxIdStringLength): string {
  return Array(length)
    .fill(0)
    .map(() => Math.random().toString(36).charAt(2)) // Get a random character each time
    .join("");
}

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

function stubArNSQuoteInsert({
  currency_type = "usd",
  nonce = randomUUID(),
  owner = stubArweaveUserAddress,
  payment_amount = "100",
  quoted_payment_amount = "150",
  winc_qty = "1337",
  mario_qty = "1337",
  quote_expiration_date = oneHourFromNow,
  payment_provider = "stripe",
  increase_qty = undefined,
  years = undefined,
  name = "The Stubbiest Name",
  type = "permabuy",
  process_id = stubTxId1,
  intent = "Buy-Name",
  usd_ar_rate = 1,
  usd_ario_rate = 1,
  excess_winc = "0",
}: Partial<ArNSPurchaseQuoteDBInsert>): ArNSPurchaseQuoteDBInsert {
  return {
    currency_type,
    nonce,
    owner,
    payment_amount,
    quoted_payment_amount,
    winc_qty,
    mario_qty,
    quote_expiration_date,
    payment_provider,
    increase_qty,
    years,
    name,
    type,
    process_id,
    intent,
    usd_ar_rate,
    usd_ario_rate,
    excess_winc,
  };
}

function stubFailedArNSPurchase({
  created_date,
  currency_type = "usd",
  excess_winc = "0",
  failed_reason = "Failed to process payment",
  intent = "Buy-Name",
  message_id = "The Stubbiest Message",
  name = "The Stubbiest Name",
  nonce = randomUUID(),
  owner = stubArweaveUserAddress,
  payment_amount = "100",
  payment_provider = "stripe",
  process_id = stubTxId1,
  quoted_payment_amount = "150",
  type = "permabuy",
  usd_ar_rate = 1,
  usd_ario_rate = 1,
  winc_qty = "1337",
  years = undefined,
  increase_qty = undefined,
  quote_expiration_date = oneHourFromNow,
  mario_qty = "1337",
}: Partial<FailedArNSPurchaseDBInsert>): FailedArNSPurchaseDBInsert {
  return {
    failed_reason,
    intent,
    mario_qty,
    name,
    nonce,
    owner,
    usd_ar_rate,
    usd_ario_rate,
    winc_qty,
    created_date,
    currency_type,
    excess_winc,
    increase_qty,
    message_id,
    payment_amount,
    payment_provider,
    process_id,
    quoted_payment_amount,
    type,
    years,
    quote_expiration_date,
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

function stubPendingPaymentTxInsert({
  destination_address = stubArweaveUserAddress,
  destination_address_type = "arweave",
  created_date,
  winston_credit_amount = "100",
  transaction_quantity = "100",
  transaction_id = "The Stubbiest Transaction" + Math.random(),
  token_type = "arweave",
}: Partial<PendingPaymentTransactionDBResult>): PendingPaymentTransactionDBInsert {
  return {
    transaction_id,
    token_type,
    created_date,
    destination_address,
    destination_address_type,
    transaction_quantity,
    winston_credit_amount,
  };
}

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

  public get knex(): Knex {
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

  public async insertStubArNSQuote(
    insertParams: Partial<ArNSPurchaseQuoteDBInsert>
  ): Promise<void> {
    return this.knex(tableNames.arNSPurchaseQuote).insert(
      stubArNSQuoteInsert(insertParams)
    );
  }

  public async insertStubFailedArNSPurchase(
    insertParams: Partial<FailedArNSPurchaseDBInsert>
  ): Promise<void> {
    return this.knex(tableNames.failedArNSPurchase).insert(
      stubFailedArNSPurchase(insertParams)
    );
  }

  public async createStubDelegatedPaymentApproval({
    approval_data_item_id,
    approved_address = stubArweaveUserAddress,
    approved_winc_amount = "100",
    expiration_date,
    paying_address = stubArweaveUserAddress,
    createPayer = true,
  }: Partial<DelegatedPaymentApprovalDBInsert> & { createPayer?: boolean }) {
    if (createPayer) {
      try {
        await this.insertStubUser({
          user_address: paying_address,
          winston_credit_balance: "1000",
        });
      } catch {
        // User already exists
      }
    }

    approval_data_item_id ??= randomCharString();

    return this.knex<DelegatedPaymentApprovalDBResult>(
      tableNames.delegatedPaymentApproval
    ).insert({
      approval_data_item_id,
      approved_address,
      approved_winc_amount,
      expiration_date,
      paying_address,
    });
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

  public async insertStubPendingPaymentTransaction(
    insertParams: Partial<PendingPaymentTransactionDBInsert>
  ): Promise<void> {
    return this.knex(tableNames.pendingPaymentTransaction).insert(
      stubPendingPaymentTxInsert(insertParams)
    );
  }

  public async insertStubArNSPurchase({
    nonce = randomCharString(),
    mario_qty = "100",
    name = "The Stubbiest Name",
    owner = "The Stubbiest Owner",
    type = "permabuy",
    winc_qty = "100",
    years = undefined,
    process_id = undefined,
    intent = "Buy-Name",
    increase_qty = undefined,
    usd_ar_rate = 1,
    usd_ario_rate = 1,
    currency_type,
    excess_winc,
    overflow_spend,
    paid_by,
    payment_amount,
    quoted_payment_amount,
    quote_expiration_date,
    payment_provider,
    quote_creation_date,
    message_id = "The Stubbiest Message",
  }: Partial<ArNSPurchaseDBInsert>): Promise<void> {
    const insert: ArNSPurchaseDBInsert = {
      nonce,
      mario_qty,
      name,
      owner,
      type,
      winc_qty,
      years,
      process_id,
      intent,
      increase_qty,
      usd_ar_rate,
      usd_ario_rate,
      currency_type,
      excess_winc,
      overflow_spend,
      paid_by,
      payment_amount,
      quoted_payment_amount,
      quote_expiration_date,
      payment_provider,
      quote_creation_date,
      message_id,
    };
    return this.knex(tableNames.arNSPurchaseReceipt).insert(insert);
  }
}
