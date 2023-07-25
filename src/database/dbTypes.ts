import { PublicArweaveAddress } from "../types";
import { WC } from "../types/arc";

export type Adjustment = {
  id: string;
  name: string;
  description?: string;
  /** value to calculate adjustment ( Multiplier or Added Value ) */
  value: number;
  operator: "multiply" | "add";
  /** Amount of winc this adjustment changes (e.g -600 for 600 winc saved)  */
  adjustmentAmount: WC;
};

export type APIAdjustment = Omit<Adjustment, "id">;

export type KeyedAdjustments = Record<string, Adjustment>;

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
export type PromotionalInfo = Record<AdjustmentId, JsonSerializable>;

type IdType = string;

export type TopUpQuoteId = IdType;
export type PaymentReceiptId = IdType;
export type ChargebackReceiptId = IdType;
export type ReservationId = IdType;
export type AdjustmentId = IdType;
export type DataItemId = IdType;

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
  adjustments: Adjustment[];
}

export type CreateBalanceReservationParams = {
  reservationId: ReservationId;
  userAddress: UserAddress;
  reservedWincAmount: WC;
  adjustments?: Adjustment[];
};

export interface FinalizedReservation extends BalanceReservation {
  finalizedDate: Timestamp;
  amortizedWincAmount: WC;
}

export interface RefundedReservation extends BalanceReservation {
  refundedDate: Timestamp;
  refundedReason: string;
}

export type CreateRefundReservationParams = {
  reservationId: ReservationId;
  refundedReason: string;
};

export type AdjustmentScope = "upload" | "payment";
export type AdjustmentOperator = "add" | "multiply";
export type ThresholdOperator = "greater_than" | "less_than";
export type AdjustmentUnit = "bytes" | "winc" | "payment_amount";

export type AdjustmentApplicability =
  | "apply_to_all" // e.g FWD Research allows all users to use this adjustment
  | "quantity_limited" // e.g PDS subsidy allows X bytes per month
  | "redeemed_code" // e.g Only allowed to use this adjustment if user has redeemed a code (e.g free GiB from a promotion)
  | "privileged_users" // e.g Only allowed to use this adjustment if user has corresponding adjustment id in their promotional info
  | "disabled"; // e.g Disabled adjustment (e.g event ended or for security reasons)

export type AdjustmentThreshold = {
  unit: AdjustmentUnit;
  value: string;
  operator: ThresholdOperator;
};

export interface PriceAdjustment {
  id: AdjustmentId;
  name: string;
  description?: string;

  applicability: AdjustmentApplicability;
  applicabilityInfo?: JsonSerializable;

  scope: AdjustmentScope;
  threshold?: AdjustmentThreshold;

  priority: number;
  operator: AdjustmentOperator;
  value: number;

  startDate: Timestamp;
  expirationDate?: Timestamp;
}

// export type ScopedPriceAdjustment = AdjustmentBase &
//   (
//     | {
//         scope: "upload";
//         threshold?: {
//           unit: "bytes" | "winc";
//           value: WC | ByteCount;
//           operator: ThresholdOperator;
//         };
//       }
//     | {
//         scope: "payment";
//         threshold?: {
//           unit: "payment_amount" | "winc";
//           value: WC | PaymentAmount;
//           operator: ThresholdOperator;
//         };
//       }
//   );

// export type PriceAdjustment = ScopedPriceAdjustment &
//   (
//     | {
//         applicability: "apply_to_all" | "privileged_users" | "disabled";
//         applicabilityInfo?: undefined;
//       }
//     | {
//         applicability: "quantity_limit";
//         applicabilityInfo: {
//           max_quantity: string;
//           reset_interval_days: number;
//         };
//       }
//     | {
//         applicability: "redeemed_code";
//         applicabilityInfo: {
//           available_codes: string[];
//           used_codes: string[];
//         };
//       }
//   );

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
  adjustments?: Record<string, Adjustment>;
}

export interface BalanceReservationDBResult extends BalanceReservationDBInsert {
  reserved_date: string;
}

export interface FinalizedReservationDBInsert
  extends BalanceReservationDBResult {
  amortized_winc_amount: string;
}

export interface FinalizedReservationDBResult
  extends FinalizedReservationDBInsert {
  finalized_date: string;
}

export interface RefundReservationDBInsert extends BalanceReservationDBResult {
  refunded_reason: string;
}

export interface RefundReservationDBResult extends RefundReservationDBInsert {
  refund_date: string;
}

export interface PriceAdjustmentDBResult {
  adjustment_id: string;
  adjustment_name: string;
  adjustment_description: string | null;

  adjustment_scope: string;
  adjustment_applicability: string;
  adjustment_applicability_info: JsonSerializable | null;

  adjustment_operator: string;
  adjustment_value: number;
  adjustment_priority: number;

  adjustment_start_date: string;
  adjustment_expiration_date: string | null;

  adjustment_threshold?: {
    value: string;
    operator: string;
    unit: string;
  } | null;
}
