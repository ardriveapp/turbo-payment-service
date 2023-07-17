import { AdjustmentResult } from "../pricing/pricing";
import { PublicArweaveAddress } from "../types";
import { WC } from "../types/arc";

export type UserAddress = string | PublicArweaveAddress;
export type UserAddressType = string | "arweave";

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

export type PaymentAmount = number;

export type CurrencyType = string;

export type PaymentProvider = string | "stripe"; // TODO: "apple-pay"

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
  destinationAddressType: UserAddressType;
  paymentAmount: PaymentAmount;
  currencyType: CurrencyType;
  winstonCreditAmount: WC;
  quoteExpirationDate: Timestamp;
  quoteCreationDate: Timestamp;
  paymentProvider: PaymentProvider;
}

export type CreateTopUpQuoteParams = Omit<TopUpQuote, "quoteCreationDate">;

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
}

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

export interface BalanceReservation {
  reservationId: ReservationId;
  userAddress: UserAddress;
  reservedDate: Timestamp;
  reservedWincAmount: WC;
  adjustments: AdjustmentResult;
}

export type CreateBalanceReservationParams = {
  reservationId: ReservationId;
  userAddress: UserAddress;
  reservedWincAmount: WC;
  adjustments?: AdjustmentResult;
};

export type AdjustmentTarget = "upload" | "payment";
export type AdjustmentOperator = "add" | "multiply";
export interface PriceAdjustment {
  adjustmentId: AdjustmentId;
  adjustmentName: string;
  adjustmentTarget: AdjustmentTarget;
  adjustmentOperator: AdjustmentOperator;
  adjustmentValue: number;
  adjustmentPriority: number;
  adjustmentStartDate: Timestamp;
  adjustmentExpirationDate: Timestamp;
}

export interface UserDBInsert {
  user_address: string;
  user_address_type: string;
  winston_credit_balance: string;
}

export type AuditChangeReason =
  | "upload"
  | "payment"
  | "account_creation"
  | "chargeback"
  | "refund";

export interface AuditLogInsert {
  user_address: string;
  winston_credit_amount: string;
  change_reason: AuditChangeReason;
  change_id?: string;
}

export interface AuditLogDBResult extends AuditLogInsert {
  audit_id: number;
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
  currency_type: string;
  winston_credit_amount: string;
  payment_provider: string;
  quote_expiration_date: string;
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
  user_address: string;
  reserved_winc_amount: string;
  adjustments?: AdjustmentResult;
}

export interface BalanceReservationDBResult extends BalanceReservationDBInsert {
  reserved_date: string;
}

export interface PriceAdjustmentDBResult {
  adjustment_id: string;
  adjustment_name: string;
  adjustment_target: string;
  adjustment_operator: string;
  adjustment_value: number;
  adjustment_priority: number;
  adjustment_start_date: string;
  adjustment_expiration_date: string;
}
