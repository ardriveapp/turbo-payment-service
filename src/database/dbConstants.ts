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
export const tableNames = {
  user: "user",
  topUpQuote: "top_up_quote",
  failedTopUpQuote: "failed_top_up_quote",
  paymentReceipt: "payment_receipt",
  chargebackReceipt: "chargeback_receipt",
  auditLog: "audit_log",
  balanceReservation: "balance_reservation",
  // TODO: refundedReservation, finalizedReservation

  uploadAdjustment: "upload_adjustment",
  paymentAdjustment: "payment_adjustment",

  uploadAdjustmentCatalog: "upload_adjustment_catalog",
  paymentAdjustmentCatalog: "payment_adjustment_catalog",
  singleUseCodePaymentAdjustmentCatalog:
    "single_use_code_payment_adjustment_catalog",

  unredeemedGift: "unredeemed_gift",
  redeemedGift: "redeemed_gift",

  pendingPaymentTransaction: "pending_payment_transaction",
  creditedPaymentTransaction: "credited_payment_transaction",
  failedPaymentTransaction: "failed_payment_transaction",

  delegatedPaymentApproval: "delegated_payment_approval",
  inactiveDelegatedPaymentApproval: "inactive_delegated_payment_approval",

  arNSPurchaseQuote: "arns_purchase_quote",
  arNSPurchaseReceipt: "arns_purchase_receipt",
  failedArNSPurchase: "failed_arns_purchase",
} as const;

export const columnNames = {
  // User
  userAddress: "user_address",
  userAddressType: "user_address_type",
  userCreationDate: "user_creation_date",
  winstonCreditBalance: "winston_credit_balance",
  promotionalInfo: "promotional_info",

  // Top up quote
  topUpQuoteId: "top_up_quote_id",
  destinationAddress: "destination_address",
  destinationAddressType: "destination_address_type",
  paymentAmount: "payment_amount", // amount we will expect from payment provider
  quotedPaymentAmount: "quoted_payment_amount", // amount before payment-exclusive adjustments
  currencyType: "currency_type",
  winstonCreditAmount: "winston_credit_amount",
  quoteExpirationDate: "quote_expiration_date",
  quoteCreationDate: "quote_creation_date",
  paymentProvider: "payment_provider",
  giftMessage: "gift_message", // Optional gift message, ignored in non-gift top-ups for now

  // Failed top up quote
  failedReason: "failed_reason",
  quoteFailedDate: "quote_failed_date",

  // Payment receipt
  paymentReceiptId: "payment_receipt_id",
  paymentReceiptDate: "payment_receipt_date",

  // Chargeback receipt
  chargebackReceiptId: "chargeback_receipt_id",
  chargebackReason: "chargeback_reason",
  chargebackReceiptDate: "chargeback_receipt_date",

  // Balance reservation
  reservationId: "reservation_id",
  dataItemId: "data_item_id",
  reservedDate: "reserved_date",
  networkWincAmount: "network_winc_amount", // amount before adjustments
  reservedWincAmount: "reserved_winc_amount", // amount reserved after adjustments
  overflowSpend: "overflow_spend",

  // Adjustments
  adjustmentId: "adjustment_id",
  adjustmentDate: "adjustment_date",
  adjustmentIndex: "adjustment_index", // ordering index with which adjustment should be applied to associated reservation_id
  adjustedWincAmount: "adjusted_winc_amount",
  adjustedPaymentAmount: "adjusted_payment_amount",
  adjustedCurrencyType: "adjusted_currency_type",

  // Audit Log
  auditId: "audit_id",
  auditDate: "audit_date",
  changeReason: "change_reason",
  changeId: "change_id",

  // Adjustment Catalog
  catalogId: "catalog_id",
  adjustmentName: "adjustment_name",
  adjustmentDescription: "adjustment_description",
  adjustmentStartDate: "adjustment_start_date",
  adjustmentEndDate: "adjustment_end_date",

  // Upload Adjustment Catalog
  byteCountThreshold: "byte_count_threshold",
  wincLimitation: "winc_limitation",
  limitationInterval: "limitation_interval",
  limitationIntervalUnit: "limitation_interval_unit",

  adjustmentPriority: "adjustment_priority",
  // inclusive: applied within the payment that is made, exclusive: applied before payment is made where user can see the adjustment
  adjustmentExclusivity: "adjustment_exclusivity",
  adjustmentCodeValue: "code_value",
  targetUserGroup: "target_user_group",
  maxUses: "max_uses",
  minimumPaymentAmount: "minimum_payment_amount",
  maximumDiscountAmount: "maximum_discount_amount",

  operator: "operator",
  operatorMagnitude: "operator_magnitude",

  // Unredeemed Gift
  giftedWincAmount: "gifted_winc_amount",
  recipientEmail: "recipient_email",
  senderEmail: "sender_email",
  creationDate: "creation_date",
  expirationDate: "expiration_date",

  // Redeemed Gift
  redemptionDate: "redemption_date",

  // Pending Transaction Payment
  tokenType: "token_type",
  transactionId: "transaction_id",
  blockHeight: "block_height",
  createdDate: "created_date",
  transactionQuantity: "transaction_quantity",

  // Failed Payment Transaction
  failedDate: "failed_date",

  // Credited Payment Transaction
  creditedDate: "credited_date",

  // Delegated Payment Approval
  approvalDataItemId: "approval_data_item_id",
  // creationDate: "creation_date",
  // expirationDate: "expiration_date", // nullable
  approvedAddress: "approved_address",
  payingAddress: "paying_address",
  approvedWincAmount: "approved_winc_amount", // amount approved
  usedWincAmount: "used_winc_amount", // amount used up

  // Inactive Delegated Payment Approval
  // extends delegated_payment_approval
  inactiveReason: "inactive_reason", // 'expired', 'used', 'revoked'
  inactiveDate: "inactive_date",
  revokeDataItemId: "revoke_data_item_id", // nullable, exists if inactive_reason is 'revoked'

  // ArNS Name Purchase
  nonce: "nonce",
  name: "name",
  owner: "owner",
  type: "type",
  years: "years",
  wincQty: "winc_qty",
  mARIOQty: "mario_qty",
  processId: "process_id",
  increaseQty: "increase_qty",
  intent: "intent",
  usdArRate: "usd_ar_rate", // USD to AR rate at the time of purchase
  usdArioRate: "usd_ario_rate", // USD to ARIO rate at the time of purchase
  messageId: "message_id",
  excessWinc: "excess_winc",
  paidBy: "paid_by", // CSV of user addresses
} as const;
