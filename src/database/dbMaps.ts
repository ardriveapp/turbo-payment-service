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
import { mARIOToken } from "@ar.io/sdk";
import BigNumber from "bignumber.js";

import { PositiveFiniteInteger, TokenType } from "../types";
import { W, Winston } from "../types/winston";
import {
  AdjustmentCatalog,
  AdjustmentCatalogDBResult,
  ArNSNameType,
  ArNSPurchase,
  ArNSPurchaseDBResult,
  ArNSPurchaseIntent,
  ArNSPurchaseQuote,
  ArNSPurchaseQuoteDBInsert,
  ArNSPurchaseQuoteDBResult,
  ArNSPurchaseQuoteParams,
  ArNSPurchaseStatusResult,
  ChargebackReceipt,
  ChargebackReceiptDBResult,
  CreditedPaymentTransaction,
  CreditedPaymentTransactionDBResult,
  DelegatedPaymentApproval,
  DelegatedPaymentApprovalDBResult,
  DestinationAddressType,
  FailedArNSPurchase,
  FailedArNSPurchaseDBResult,
  FailedPaymentTransaction,
  FailedPaymentTransactionDBResult,
  FailedTopUpQuote,
  FailedTopUpQuoteDBResult,
  InactiveDelegatedPaymentApproval,
  InactiveDelegatedPaymentApprovalDBResult,
  InactiveDelegatedPaymentReason,
  IntervalUnit,
  PaymentAdjustmentCatalog,
  PaymentAdjustmentCatalogDBResult,
  PaymentReceipt,
  PaymentReceiptDBResult,
  PendingPaymentTransaction,
  PendingPaymentTransactionDBResult,
  PromotionalInfo,
  SingleUseCodePaymentCatalog,
  SingleUseCodePaymentCatalogDBResult,
  TopUpQuote,
  TopUpQuoteDBResult,
  UnredeemedGift,
  UnredeemedGiftDBResult,
  UploadAdjustmentCatalog,
  UploadAdjustmentCatalogDBResult,
  User,
  UserAddressType,
  UserDBResult,
  failedPurchaseStatus,
  pendingPurchaseStatus,
  successPurchaseStatus,
} from "./dbTypes";

export function userDBMap({
  promotional_info,
  user_address,
  user_creation_date,
  winston_credit_balance,
  user_address_type,
}: UserDBResult): User {
  return {
    promotionalInfo: promotional_info as PromotionalInfo,
    userAddress: user_address,
    userAddressType: user_address_type as UserAddressType,
    userCreationDate: user_creation_date,
    winstonCreditBalance: new Winston(winston_credit_balance),
  };
}

export function topUpQuoteDBMap({
  payment_amount,
  quoted_payment_amount,
  currency_type,
  payment_provider,
  top_up_quote_id,
  quote_creation_date,
  quote_expiration_date,
  destination_address,
  destination_address_type,
  winston_credit_amount,
}: TopUpQuoteDBResult): TopUpQuote {
  return {
    paymentAmount: +payment_amount,
    quotedPaymentAmount: +quoted_payment_amount,
    currencyType: currency_type,
    paymentProvider: payment_provider,
    topUpQuoteId: top_up_quote_id,
    quoteCreationDate: quote_creation_date,
    quoteExpirationDate: quote_expiration_date,
    destinationAddress: destination_address,
    destinationAddressType: destination_address_type as DestinationAddressType,
    winstonCreditAmount: new Winston(winston_credit_amount),
  };
}

export function failedTopUpQuoteDBMap(
  dbResult: FailedTopUpQuoteDBResult
): FailedTopUpQuote {
  return {
    ...topUpQuoteDBMap(dbResult),
    failedReason: dbResult.failed_reason,
    quoteFailedDate: dbResult.quote_failed_date,
  };
}

export function paymentReceiptDBMap(
  dbResult: PaymentReceiptDBResult
): PaymentReceipt {
  return {
    ...topUpQuoteDBMap(dbResult),
    paymentReceiptDate: dbResult.payment_receipt_date,
    paymentReceiptId: dbResult.payment_receipt_id,
  };
}

export function chargebackReceiptDBMap(
  dbResult: ChargebackReceiptDBResult
): ChargebackReceipt {
  return {
    ...paymentReceiptDBMap(dbResult),
    chargebackReceiptDate: dbResult.chargeback_receipt_date,
    chargebackReason: dbResult.chargeback_reason,
    chargebackReceiptId: dbResult.chargeback_receipt_id,
  };
}

function priceAdjustmentCatalogDBMap({
  catalog_id,
  adjustment_name,
  adjustment_description,
  operator,
  operator_magnitude,
  adjustment_priority,
  adjustment_start_date,
  adjustment_end_date,
}: AdjustmentCatalogDBResult): AdjustmentCatalog {
  return {
    catalogId: catalog_id,
    name: adjustment_name,
    description: adjustment_description,
    startDate: adjustment_start_date,
    endDate: adjustment_end_date,
    priority: adjustment_priority,
    operator,
    operatorMagnitude: +operator_magnitude,
  };
}

export function uploadAdjustmentCatalogDBMap(
  dbResult: UploadAdjustmentCatalogDBResult
): UploadAdjustmentCatalog {
  return {
    ...priceAdjustmentCatalogDBMap(dbResult),
    byteCountThreshold: new PositiveFiniteInteger(
      +dbResult.byte_count_threshold
    ),
    wincLimitation: W(dbResult.winc_limitation),
    limitationInterval: +dbResult.limitation_interval,
    limitationIntervalUnit: dbResult.limitation_interval_unit as IntervalUnit,
  };
}

export function paymentAdjustmentCatalogDBMap(
  dbResult: PaymentAdjustmentCatalogDBResult
): PaymentAdjustmentCatalog {
  return {
    ...priceAdjustmentCatalogDBMap(dbResult),
    exclusivity: dbResult.adjustment_exclusivity,
  };
}

export function singleUseCodePaymentCatalogDBMap(
  dbResult: SingleUseCodePaymentCatalogDBResult
): SingleUseCodePaymentCatalog {
  return {
    ...paymentAdjustmentCatalogDBMap(dbResult),
    codeValue: dbResult.code_value,
    targetUserGroup: dbResult.target_user_group,
    maxUses: dbResult.max_uses,
    minimumPaymentAmount: dbResult.minimum_payment_amount,
    maximumDiscountAmount: dbResult.maximum_discount_amount,
  };
}

export function unredeemedGiftDBMap(
  dbResult: UnredeemedGiftDBResult
): UnredeemedGift {
  return {
    paymentReceiptId: dbResult.payment_receipt_id,
    giftedWincAmount: new Winston(dbResult.gifted_winc_amount),
    recipientEmail: dbResult.recipient_email,
    giftMessage: dbResult.gift_message,
    giftCreationDate: dbResult.creation_date,
    giftExpirationDate: dbResult.expiration_date,
    senderEmail: dbResult.sender_email,
  };
}

export function pendingPaymentTransactionDBMap(
  dbResult: PendingPaymentTransactionDBResult
): PendingPaymentTransaction {
  return {
    transactionQuantity: BigNumber(dbResult.transaction_quantity),
    transactionId: dbResult.transaction_id,
    tokenType: dbResult.token_type as TokenType,
    destinationAddress: dbResult.destination_address,
    destinationAddressType:
      dbResult.destination_address_type as DestinationAddressType,
    createdDate: dbResult.created_date,
    winstonCreditAmount: W(dbResult.winston_credit_amount),
  };
}

export function failedTransactionDBMap(
  dbResult: FailedPaymentTransactionDBResult
): FailedPaymentTransaction {
  return {
    ...pendingPaymentTransactionDBMap(dbResult),
    failedDate: dbResult.failed_date,
    failedReason: dbResult.failed_reason,
  };
}

export function creditedTransactionDBMap(
  dbResult: CreditedPaymentTransactionDBResult
): CreditedPaymentTransaction {
  return {
    ...pendingPaymentTransactionDBMap(dbResult),
    creditedDate: dbResult.credited_transaction_date,
    blockHeight: dbResult.block_height,
  };
}

export function delegatedPaymentApprovalDBMap(
  dbResult: DelegatedPaymentApprovalDBResult
): DelegatedPaymentApproval {
  return {
    approvalDataItemId: dbResult.approval_data_item_id,
    approvedAddress: dbResult.approved_address,
    approvedWincAmount: W(dbResult.approved_winc_amount),
    creationDate: dbResult.creation_date,
    payingAddress: dbResult.paying_address,
    usedWincAmount: W(dbResult.used_winc_amount),
    expirationDate: dbResult.expiration_date ?? undefined,
  };
}

export function inactiveDelegatedPaymentApprovalDBMap(
  dbResult: InactiveDelegatedPaymentApprovalDBResult
): InactiveDelegatedPaymentApproval {
  return {
    ...delegatedPaymentApprovalDBMap(dbResult),
    inactiveReason: dbResult.inactive_reason as InactiveDelegatedPaymentReason,
    inactiveDate: dbResult.inactive_date,
    revokeDataItemId: dbResult.revoke_data_item_id ?? undefined,
  };
}

export function arnsPurchaseReceiptDBMap(
  dbResult: ArNSPurchaseDBResult
): ArNSPurchase {
  return {
    nonce: dbResult.nonce,
    intent: dbResult.intent,
    name: dbResult.name,
    owner: dbResult.owner,
    type: dbResult.type ?? undefined,
    years: dbResult.years ?? undefined,
    increaseQty: dbResult.increase_qty ?? undefined,
    wincQty: W(dbResult.winc_qty),
    mARIOQty: new mARIOToken(+dbResult.mario_qty),
    processId: dbResult.process_id ?? undefined,
    createdDate: dbResult.created_date ?? undefined,
    usdArRate: dbResult.usd_ar_rate,
    usdArioRate: dbResult.usd_ario_rate,

    quoteCreationDate: dbResult.quote_creation_date ?? undefined,
    quoteExpirationDate: dbResult.quote_expiration_date ?? undefined,
    paymentAmount: dbResult.payment_amount
      ? +dbResult.payment_amount
      : undefined,
    quotedPaymentAmount: dbResult.quoted_payment_amount
      ? +dbResult.quoted_payment_amount
      : undefined,
    currencyType: dbResult.currency_type ?? undefined,
    paymentProvider: dbResult.payment_provider ?? undefined,
    paidBy: dbResult.paid_by?.split(",") ?? [],
    messageId: dbResult.message_id ?? undefined,
    excessWincAmount: dbResult.excess_winc
      ? W(dbResult.excess_winc)
      : undefined,
  };
}

export function failedArNSNamePurchaseDBMap(
  dbResult: FailedArNSPurchaseDBResult
): FailedArNSPurchase {
  return {
    ...arnsPurchaseReceiptDBMap(dbResult as ArNSPurchaseDBResult),
    failedReason: dbResult.failed_reason,
    failedDate: dbResult.failed_date,
  };
}

export function isFailedArNSNamePurchaseDBResult(
  dbResult:
    | ArNSPurchaseDBResult
    | FailedArNSPurchaseDBResult
    | ArNSPurchaseQuoteDBResult
): dbResult is FailedArNSPurchaseDBResult {
  return "failed_date" in dbResult;
}
export function isArNSPurchaseDBResult(
  dbResult: ArNSPurchaseDBResult | ArNSPurchaseQuoteDBResult
): dbResult is ArNSPurchaseDBResult {
  return "created_date" in dbResult;
}

export function arnsPurchaseDBMap(
  dbResult:
    | FailedArNSPurchaseDBResult
    | ArNSPurchaseDBResult
    | ArNSPurchaseQuoteDBResult
): ArNSPurchaseStatusResult {
  if (isFailedArNSNamePurchaseDBResult(dbResult)) {
    return {
      ...failedArNSNamePurchaseDBMap(dbResult),
      status: failedPurchaseStatus,
    };
  } else if (isArNSPurchaseDBResult(dbResult)) {
    return {
      ...arnsPurchaseReceiptDBMap(dbResult),
      status: successPurchaseStatus,
    };
  } else {
    return {
      ...arnsPurchaseQuoteDBMap(dbResult),
      status: pendingPurchaseStatus,
    };
  }
}

export function arnsPurchaseQuoteDBMap(
  dbResult: ArNSPurchaseQuoteDBResult
): ArNSPurchaseQuote {
  return {
    nonce: dbResult.nonce,
    intent: dbResult.intent as ArNSPurchaseIntent,
    name: dbResult.name,
    type: (dbResult.type as ArNSNameType) ?? undefined,
    years: dbResult.years ?? undefined,
    increaseQty: dbResult.increase_qty ?? undefined,
    processId: dbResult.process_id ?? undefined,
    usdArRate: dbResult.usd_ar_rate,
    usdArioRate: dbResult.usd_ario_rate,
    mARIOQty: new mARIOToken(+dbResult.mario_qty),
    wincQty: W(dbResult.winc_qty),
    owner: dbResult.owner,
    quoteCreationDate: dbResult.quote_creation_date,
    quoteExpirationDate: dbResult.quote_expiration_date,
    paymentAmount: +dbResult.payment_amount,
    quotedPaymentAmount: +dbResult.quoted_payment_amount,
    currencyType: dbResult.currency_type,
    paymentProvider: dbResult.payment_provider,
    excessWincAmount: W(dbResult.excess_winc),
  };
}

export function arnsPurchaseQuoteDBInsertFromParams({
  currencyType,
  intent,
  mARIOQty,
  name,
  nonce,
  owner,
  paymentAmount,
  paymentProvider,
  quoteExpirationDate,
  quotedPaymentAmount,
  usdArRate,
  usdArioRate,
  wincQty,
  increaseQty,
  processId,
  type,
  years,
  excessWincAmount,
}: ArNSPurchaseQuoteParams): ArNSPurchaseQuoteDBInsert {
  return {
    currency_type: currencyType,
    intent,
    mario_qty: mARIOQty.toString(),
    name,
    nonce,
    owner,
    payment_amount: paymentAmount.toString(),
    payment_provider: paymentProvider,
    quote_expiration_date: quoteExpirationDate,
    quoted_payment_amount: quotedPaymentAmount.toString(),
    usd_ar_rate: usdArRate,
    usd_ario_rate: usdArioRate,
    winc_qty: wincQty.toString(),
    increase_qty: increaseQty,
    process_id: processId,
    type,
    years,
    excess_winc: excessWincAmount.toString(),
  };
}
