import { WC } from "../types/arc";
import { PublicArweaveAddress } from "../types/types";

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

export type PaymentAmount = number;

// TODO: Should we define these types here? e.g: `'usd' | 'etc'`
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

export interface UserDBInsert {
  user_address: string;
  user_address_type: string;
  winston_credit_balance: string;
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
