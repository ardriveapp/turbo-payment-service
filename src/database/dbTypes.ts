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
import { Knex } from "knex";

import { FinalPrice, NetworkPrice } from "../pricing/price";
import {
  ByteCount,
  PublicArweaveAddress,
  TokenType,
  TransactionId,
  WC,
  Winston,
} from "../types";
import "../types/arc";

export interface Adjustment {
  name: string;
  description: string;
  /** value to calculate adjustment ( Multiplier or Added Value ) */
  operatorMagnitude: number;
  operator: "multiply" | "add";
  adjustmentAmount: WC | number;
  catalogId: IdType;
}

export interface UploadAdjustment extends Adjustment {
  /** Amount of winc this adjustment changes (e.g -600 for 600 winc saved)  */
  adjustmentAmount: WC;
}

export interface PaymentAdjustment extends Adjustment {
  /** Amount of payment amount (usd, eur, btc) this adjustment changes (e.g -600 for 600 dollars saved) */
  adjustmentAmount: PaymentAmount | Winston;
  currencyType: CurrencyType;
  maxDiscount?: number;
  promoCode?: string;
}

export type UserAddress = string | PublicArweaveAddress;

export const userAddressTypes = [
  "arweave",
  "ario",
  "solana",
  "ed25519",
  "ethereum",
  "kyve",
  "matic",
  "pol",
  "base-eth",
] as const;
export type UserAddressType = (typeof userAddressTypes)[number];

export const destinationAddressTypes = [...userAddressTypes, "email"] as const;
export type DestinationAddressType = (typeof destinationAddressTypes)[number];

/** Currently using Postgres Date type (ISO String) */
export type Timestamp = string;

export type JsonSerializable =
  | string
  | number
  | boolean
  | null
  | { [member: string]: JsonSerializable }
  | JsonSerializable[];

// TODO: Promotional Info Schema. We will use JSON object
export type PromotionalInfo = Record<string, JsonSerializable>;

type IdType = string;

export type TopUpQuoteId = IdType;
export type PaymentReceiptId = IdType;
export type ChargebackReceiptId = IdType;
export type ReservationId = IdType;
export type AdjustmentId = IdType;

export type DataItemId = IdType;

export type PaymentAmount = number;

export type CurrencyType = string;

export type PaymentProvider = string | "stripe" | "admin"; // TODO: "apple-pay"

export interface User {
  userAddress: UserAddress;
  userAddressType: UserAddressType;
  userCreationDate: Timestamp;
  winstonCreditBalance: WC;
  promotionalInfo: PromotionalInfo;
}

export interface TopUpQuote {
  topUpQuoteId: TopUpQuoteId;
  destinationAddress: UserAddress;
  destinationAddressType: DestinationAddressType;
  paymentAmount: PaymentAmount;
  quotedPaymentAmount: PaymentAmount;
  currencyType: CurrencyType;
  winstonCreditAmount: WC;
  quoteExpirationDate: Timestamp;
  quoteCreationDate: Timestamp;
  paymentProvider: PaymentProvider;
  giftMessage?: string;
}

export type PendingPaymentTransaction = {
  transactionId: string;
  tokenType: TokenType;
  createdDate: Timestamp;

  transactionQuantity: BigNumber;
  winstonCreditAmount: WC;

  destinationAddress: UserAddress;
  destinationAddressType: DestinationAddressType;
};

export type FailedPaymentTransaction = PendingPaymentTransaction & {
  failedReason: string;
  failedDate: Timestamp;
};

export type CreditedPaymentTransaction = PendingPaymentTransaction & {
  creditedDate: Timestamp;
  blockHeight: number;
};

export type CreatePendingTransactionParams = Omit<
  PendingPaymentTransaction,
  "createdDate"
> & {
  adjustments: PaymentAdjustment[];
};

export type CreateNewCreditedTransactionParams = Omit<
  CreditedPaymentTransaction,
  "creditedDate" | "createdDate"
> & {
  adjustments: PaymentAdjustment[];
};

export type PendingPaymentTransactionDBInsert = {
  transaction_id: string;
  token_type: string;
  transaction_quantity: string;
  winston_credit_amount: string;
  destination_address: string;
  destination_address_type: string;
  created_date?: string;
};

export type PendingPaymentTransactionDBResult =
  Required<PendingPaymentTransactionDBInsert>;

export type FailedPaymentTransactionDBInsert =
  PendingPaymentTransactionDBResult & {
    failed_reason: string;
  };

export type FailedPaymentTransactionDBResult =
  FailedPaymentTransactionDBInsert & {
    failed_date: string;
  };

export type CreditedPaymentTransactionDBInsert = Omit<
  PendingPaymentTransactionDBResult,
  "created_date"
> & {
  created_date?: string;
  credited_transaction_date?: string;
  block_height: number;
};

export type CreditedPaymentTransactionDBResult =
  Required<CreditedPaymentTransactionDBInsert>;

export type CreateTopUpQuoteParams = Omit<TopUpQuote, "quoteCreationDate"> & {
  adjustments: PaymentAdjustment[];
};

export function isFailedPaymentTransactionDBResult(
  transaction:
    | PendingPaymentTransactionDBResult
    | FailedPaymentTransaction
    | CreditedPaymentTransaction
): transaction is FailedPaymentTransactionDBResult {
  return (
    (transaction as FailedPaymentTransactionDBResult).failed_reason !==
    undefined
  );
}

export function isCreditedPaymentTransactionDBResult(
  transaction:
    | PendingPaymentTransactionDBResult
    | CreditedPaymentTransaction
    | FailedPaymentTransaction
): transaction is CreditedPaymentTransactionDBResult {
  return (
    (transaction as CreditedPaymentTransactionDBResult).block_height !==
    undefined
  );
}

export interface FailedTopUpQuote extends TopUpQuote {
  failedReason: "expired" | string;
  quoteFailedDate: Timestamp;
}

export interface PaymentReceipt extends TopUpQuote {
  paymentReceiptId: PaymentReceiptId;
  paymentReceiptDate: Timestamp;
}
export interface CreatePaymentReceiptParams {
  paymentReceiptId: PaymentReceiptId;
  topUpQuoteId: TopUpQuoteId;
  paymentAmount: PaymentAmount;
  currencyType: CurrencyType;
  senderEmail?: string;
}

export type CreateBypassedPaymentReceiptParams = Omit<
  CreatePaymentReceiptParams,
  "topUpQuoteId" | "paymentReceiptId"
> & {
  destinationAddress: UserAddress;
  destinationAddressType: DestinationAddressType;
  paymentProvider: PaymentProvider;
  winc: WC;
  giftMessage?: string;
};

export interface ChargebackReceipt extends PaymentReceipt {
  chargebackReceiptId: ChargebackReceiptId;
  chargebackReason: string;
  chargebackReceiptDate: Timestamp;
}

export type CreateChargebackReceiptParams = {
  topUpQuoteId: TopUpQuoteId;
  chargebackReason: string;
  chargebackReceiptId: ChargebackReceiptId;
};

export type PendingSpend = {
  paying_address: UserAddress;
  winc_amount: WC;
};
export type OverflowSpendDBResult = {
  paying_address: string;
  winc_amount: string;
}[];
export type OverflowSpend = PendingSpend;

export interface BalanceReservation {
  reservationId: ReservationId;
  dataItemId: DataItemId;
  userAddress: UserAddress;
  reservedDate: Timestamp;
  reservedWincAmount: WC;
  networkWincAmount: WC;
  overflowSpend: OverflowSpend[];
}

export const paymentDirectives = [
  "list-only", // Only use paid-by addresses provided
  "list-or-signer", // Fallback to signer if paid-by addresses are not provided or don't cover the full cost

  // TODO: front-end can request any given approvals and decide on a list of approvals to use
  // "any", // Use paid-by addresses provided, or any approvals found, or the signer
  // "any-approval", // Use paid-by addresses provided, or any approvals found

  // TODO: front-end can do this by inserting the signer as the first paid-by address
  // "signer-or-list" // Use the signer, but fallback to paid-by addresses provided
  // "signer-or-any", // Use the signer, but fallback to paid-by addresses provided or any approvals found
  // "signer-only", // Use the signer only, ignore paid-by addresses provided

  // "no-payment", // Don't use any payment method, just reserve the balance if its free otherwise let it fail
] as const;

export type PaymentDirective = (typeof paymentDirectives)[number];

export const isPaymentDirective = (value: string): value is PaymentDirective =>
  paymentDirectives.includes(value as PaymentDirective);

export type CreateBalanceReservationParams = {
  dataItemId: DataItemId;
  signerAddress: UserAddress;
  signerAddressType: UserAddressType;
  reservedWincAmount: FinalPrice;
  networkWincAmount: NetworkPrice;
  adjustments: UploadAdjustment[];

  paidBy?: UserAddress[];
  paymentDirective?: PaymentDirective;
};

export interface AdjustmentCatalog {
  catalogId: IdType;
  name: string;
  description: string;
  startDate: Timestamp;
  endDate?: Timestamp;
  operator: "add" | "multiply";
  operatorMagnitude: number;
  priority: number;
}

export type UploadAdjustmentCatalog = AdjustmentCatalog & {
  byteCountThreshold: ByteCount;
  wincLimitation: WC;
  limitationInterval: number;
  limitationIntervalUnit: IntervalUnit;
};

export interface PaymentAdjustmentCatalog extends AdjustmentCatalog {
  exclusivity: Exclusivity;
}

export interface SingleUseCodePaymentCatalog extends PaymentAdjustmentCatalog {
  codeValue: string;
  targetUserGroup: TargetUserGroup;
  maxUses: number;
  minimumPaymentAmount: number;
  maximumDiscountAmount: number;
}

export interface UserDBInsert {
  user_address: string;
  user_address_type: string;
  winston_credit_balance: string;
}

export type AuditChangeReason =
  | "upload"
  | "approved_upload"
  | "payment"
  | "crypto_payment"
  | "bypassed_payment"
  | "account_creation"
  | "bypassed_account_creation"
  | "chargeback"
  | "refund"
  | "refunded_upload"
  | "gifted_payment"
  | "bypassed_gifted_payment"
  | "gifted_payment_redemption"
  | "gifted_account_creation"
  | "delegated_payment_approval"
  | "delegated_payment_revoke"
  | "delegated_payment_expired"
  | "arns_account_creation"
  | "arns_purchase_order"
  | "approved_arns_purchase_order"
  | "arns_purchase_order_failed";

export interface AuditLogInsert {
  user_address: string;
  winston_credit_amount: string;
  change_reason: AuditChangeReason;
  change_id?: string;
}

export interface AuditLogDBResult extends AuditLogInsert {
  audit_id: number;
  audit_date: string;
}

export interface UserDBResult extends UserDBInsert {
  promotional_info: JsonSerializable;
  user_creation_date: string;
}

export interface TopUpQuoteDBInsert {
  top_up_quote_id: string;
  destination_address: string;
  destination_address_type: string;
  payment_amount: string;
  quoted_payment_amount: string;
  currency_type: string;
  winston_credit_amount: string;
  payment_provider: string;
  quote_expiration_date: string;
  gift_message?: string;
}

export interface TopUpQuoteDBResult extends TopUpQuoteDBInsert {
  quote_creation_date: string;
}

export interface FailedTopUpQuoteDBInsert extends TopUpQuoteDBResult {
  failed_reason: string;
}

export interface FailedTopUpQuoteDBResult extends FailedTopUpQuoteDBInsert {
  quote_failed_date: string;
}

export interface PaymentReceiptDBInsert extends TopUpQuoteDBResult {
  payment_receipt_id: string;
}

export interface PaymentReceiptDBResult extends PaymentReceiptDBInsert {
  payment_receipt_date: string;
}

export interface ChargebackReceiptDBInsert extends PaymentReceiptDBResult {
  chargeback_receipt_id: string;
  chargeback_reason: string;
}

export interface ChargebackReceiptDBResult extends ChargebackReceiptDBInsert {
  chargeback_receipt_date: string;
}

export interface BalanceReservationDBInsert {
  reservation_id: string;
  data_item_id: string;
  user_address: string;
  reserved_winc_amount: string;
  network_winc_amount: string;
  overflow_spend?: string;
}

export interface BalanceReservationDBResult
  extends Omit<BalanceReservationDBInsert, "overflow_spend"> {
  reserved_date: string;
  overflow_spend?: OverflowSpendDBResult; // Store as a JSON string
}

interface AdjustmentCatalogDBInsert {
  catalog_id: string;
  adjustment_name: string;
  adjustment_description?: string;

  adjustment_start_date?: string;
  adjustment_end_date?: string;

  operator: "add" | "multiply";
  operator_magnitude: string;
  adjustment_priority?: number;
}

export type UploadAdjustmentCatalogDBInsert = AdjustmentCatalogDBInsert & {
  byte_count_threshold?: string;
  winc_limitation?: string;
  limitation_interval?: string;
  limitation_interval_unit?: string;
};

export const exclusivity = [
  "inclusive",
  "exclusive",
  "inclusive_kyve",
] as const;
export type Exclusivity = (typeof exclusivity)[number];

export interface PaymentAdjustmentCatalogDBInsert
  extends AdjustmentCatalogDBInsert {
  adjustment_exclusivity?: Exclusivity;
}

type TargetUserGroup = "all" | "new" | "existing";

export interface SingleUseCodePaymentCatalogDBInsert
  extends PaymentAdjustmentCatalogDBInsert {
  code_value: string;
  target_user_group?: TargetUserGroup;
  max_uses?: number;
  minimum_payment_amount?: number;
  maximum_discount_amount?: number;
}

export interface AdjustmentCatalogDBResult extends AdjustmentCatalogDBInsert {
  adjustment_start_date: string;
  adjustment_priority: number;
  adjustment_description: string;
}

export type UploadAdjustmentCatalogDBResult = AdjustmentCatalogDBResult &
  UploadAdjustmentCatalogDBInsert & {
    byte_count_threshold: string;
    winc_limitation: string;
    limitation_interval: string;
    limitation_interval_unit: string;
  };

export type PaymentAdjustmentCatalogDBResult = AdjustmentCatalogDBResult &
  PaymentAdjustmentCatalogDBInsert & {
    adjustment_exclusivity: Exclusivity;
  };

export interface SingleUseCodePaymentCatalogDBResult
  extends PaymentAdjustmentCatalogDBResult {
  code_value: string;
  target_user_group: TargetUserGroup;
  max_uses: number;
  minimum_payment_amount: number;
  maximum_discount_amount: number;
}

interface AdjustmentDBInsert {
  catalog_id: string;
  adjustment_index: number;
  user_address: string;
}

export interface UploadAdjustmentDBInsert extends AdjustmentDBInsert {
  reservation_id: string;
  adjusted_winc_amount: string;
}

export interface AdjustmentDBResult extends AdjustmentDBInsert {
  adjustment_id: number;
  adjustment_date: string;
}

export interface UploadAdjustmentDBResult
  extends UploadAdjustmentDBInsert,
    AdjustmentDBResult {}

export interface PaymentAdjustmentDBInsert extends AdjustmentDBInsert {
  top_up_quote_id: string;
  adjusted_payment_amount: string;
  adjusted_currency_type: string;
}

export interface PaymentAdjustmentDBResult
  extends PaymentAdjustmentDBInsert,
    AdjustmentDBResult {}

export interface UnredeemedGiftDBInsert {
  payment_receipt_id: string;
  gifted_winc_amount: string;
  recipient_email: string;
  sender_email?: string;
  gift_message?: string;
}

export interface UnredeemedGiftDBResult extends UnredeemedGiftDBInsert {
  creation_date: string;
  expiration_date: string;
}

export interface RedeemedGiftDBInsert extends UnredeemedGiftDBResult {
  destination_address: string;
}

export interface RedeemedGiftDBResult extends RedeemedGiftDBInsert {
  redemption_date: string;
}

export interface UnredeemedGift {
  paymentReceiptId: PaymentReceiptId;
  giftedWincAmount: WC;
  recipientEmail: string;
  senderEmail?: string;
  giftMessage?: string;
  giftCreationDate: Timestamp;
  giftExpirationDate: Timestamp;
}

export interface RedeemedGift extends UnredeemedGift {
  destinationAddress: UserAddress;
  redemptionDate: Timestamp;
}

export type IntervalUnit = "year" | "month" | "day" | "hour" | "minute";

export interface DelegatedPaymentApprovalDBInsert {
  approval_data_item_id: string;
  approved_address: string;
  paying_address: string;
  approved_winc_amount: string;
  used_winc_amount?: string;
  expiration_date?: string;
}

export interface DelegatedPaymentApprovalDBResult
  extends DelegatedPaymentApprovalDBInsert {
  creation_date: string;
  used_winc_amount: string;
}

export type InactiveDelegatedPaymentReason = "expired" | "used" | "revoked";

export interface InactiveDelegatedPaymentApprovalDBInsert
  extends DelegatedPaymentApprovalDBResult {
  inactive_reason: InactiveDelegatedPaymentReason;
  revoke_data_item_id?: string;
}

export interface InactiveDelegatedPaymentApprovalDBResult
  extends InactiveDelegatedPaymentApprovalDBInsert {
  inactive_date: string;
  expiration_date: string;
}

export interface DelegatedPaymentApproval {
  approvalDataItemId: DataItemId;
  approvedAddress: UserAddress;
  payingAddress: UserAddress;
  approvedWincAmount: WC;
  usedWincAmount: WC;
  creationDate: Timestamp;
  expirationDate?: Timestamp;
}

export interface InactiveDelegatedPaymentApproval
  extends DelegatedPaymentApproval {
  inactiveReason: "expired" | "used" | "revoked";
  inactiveDate: Timestamp;
  revokeDataItemId?: DataItemId;
}

export interface CreateDelegatedPaymentApprovalParams {
  approvalDataItemId: DataItemId;
  approvedAddress: UserAddress;
  payingAddress: UserAddress;
  approvedWincAmount: Winston;
  expiresInSeconds?: number;
}

export interface GetBalanceResult {
  /** Amount of winc that can be spent or shared by user */
  winc: WC; // user.wincBalance - sumOfAll(givenApprovals.remainingWincFromApproval)
  /** Amount of winc that a user's account controls, and could be spent if all given approvals were revoked */
  controlledWinc: WC; // user.wincBalance
  /** Amount of winc that can be spent by the user plus winc from all received delegated balance approvals */
  effectiveBalance: WC; // user.wincBalance - sumOfAll(givenApprovals.remainingWincFromApproval) + sumOfAll(receivedApprovals.remainingWincFromApproval)

  givenApprovals: DelegatedPaymentApproval[];
  receivedApprovals: DelegatedPaymentApproval[];
}

export type KnexTransaction = Knex | Knex.Transaction;

export type ArNSNameType = "permabuy" | "lease";

export type ArNSTokenCostParams = {
  type?: ArNSNameType;
  years?: number;
  increaseQty?: number;
  name: string;
  intent: ArNSPurchaseIntent;
  /** Assert Turbo wallet has enough balance for the action */
  assertBalance?: boolean;
};

export type ArNSPurchaseParams = Omit<ArNSTokenCostParams, "assertBalance"> & {
  /** Nonce of the signed request that tells Turbo services to initiate the ArNS Purchase */
  nonce: string;
  /** User to whom charge credits for the purchase */
  owner: UserAddress;
  /** Amount of winc charged to owner */
  wincQty: WC;
  /** Equivalent value of mARIO token to winc calculated at time of purchase */
  mARIOQty: mARIOToken;
  /** ANT process to assign to the owner of the ArNS Name purchased */
  processId?: TransactionId;
  /** USD to AR rate at the time of purchase */
  usdArRate: number;
  /** USD to ARIO rate at the time of purchase */
  usdArioRate: number;
  paidBy: UserAddress[];
};

type ArNSPurchaseQuoteFields = {
  paymentAmount: PaymentAmount;
  quotedPaymentAmount: PaymentAmount;
  currencyType: CurrencyType;
  quoteExpirationDate: Timestamp;
  paymentProvider: PaymentProvider;
  excessWincAmount: WC;
};

export type ArNSPurchaseQuoteParams = Omit<
  ArNSPurchaseParams,
  "messageId" | "paidBy"
> &
  ArNSPurchaseQuoteFields & {
    adjustments: PaymentAdjustment[];
  };

export type ArNSPurchaseQuote = Omit<ArNSPurchaseQuoteParams, "adjustments"> & {
  quoteCreationDate: Timestamp;
};

export type ArNSPurchase = ArNSPurchaseParams & {
  createdDate?: Timestamp;
  messageId?: string;
  quoteCreationDate?: Timestamp;
  overflowSpend?: OverflowSpendDBResult; // Store as a JSON string
} & Partial<ArNSPurchaseQuoteFields>;

export type ArNSPurchaseResult =
  | ArNSPurchase
  | FailedArNSPurchase
  | ArNSPurchaseQuote;

export const purchaseStatus = ["pending", "success", "failed"] as const;
export const [
  pendingPurchaseStatus,
  successPurchaseStatus,
  failedPurchaseStatus,
] = purchaseStatus;
export type ArNSPurchaseStatus = (typeof purchaseStatus)[number];
export const isArNSPurchaseStatus = (
  value: string
): value is ArNSPurchaseStatus =>
  purchaseStatus.includes(value as ArNSPurchaseStatus);

export type ArNSPurchaseStatusResult = ArNSPurchaseResult & {
  status: ArNSPurchaseStatus;
};

export type FailedArNSPurchase = ArNSPurchase & {
  failedDate: Timestamp;
  failedReason: string;
};

export const isFailedArNSNamePurchase = (
  purchase: ArNSPurchase
): purchase is FailedArNSPurchase =>
  (purchase as FailedArNSPurchase).failedDate !== undefined;

export const validArNSPurchaseIntents = [
  "Buy-Name",
  "Buy-Record",
  "Extend-Lease",
  "Upgrade-Name",
  "Increase-Undername-Limit", // TODO: Handle Primary-Name-Request (anonymous initiator)
] as const;
export type ArNSPurchaseIntent = (typeof validArNSPurchaseIntents)[number];

type ArNSPurchaseDBCols = {
  nonce: string;
  name: string;
  owner: string;
  winc_qty: string;
  mario_qty: string;
  usd_ar_rate: number;
  usd_ario_rate: number;
  intent: ArNSPurchaseIntent;
  type?: ArNSNameType;
  years?: number;
  increase_qty?: number;
  process_id?: string;
  paid_by?: string;
  overflow_spend?: string;
  message_id?: string;
};

type ArNSPurchaseQuoteDBCols = {
  quote_expiration_date: string;
  quote_creation_date: string;
  payment_provider: string;
  payment_amount: string;
  quoted_payment_amount: string;
  currency_type: string;
  excess_winc: string;
};

export type ArNSPurchaseQuoteDBInsert = ArNSPurchaseDBCols &
  Omit<ArNSPurchaseQuoteDBCols, "quote_creation_date">;

export type ArNSPurchaseQuoteDBResult = ArNSPurchaseQuoteDBInsert & {
  quote_creation_date: string;
};

export type ArNSPurchaseDBInsert = ArNSPurchaseDBCols &
  Partial<ArNSPurchaseQuoteDBCols>;

export type ArNSPurchaseDBResult = ArNSPurchaseDBInsert & {
  created_date: string;
};

export type FailedArNSPurchaseDBInsert = ArNSPurchaseDBInsert & {
  created_date?: string;
  failed_reason: string;
};

export type FailedArNSPurchaseDBResult = FailedArNSPurchaseDBInsert & {
  failed_date: string;
};
