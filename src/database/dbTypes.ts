import { WC } from "../types/arc";

/** In this MVP this will be an Arweave Public Address */
export type UserAddress = string;

/** For MVP, this is: "arweave" */
export type UserAddressType = string;

/** Currently using Postgres Date type (ISO String without Timezone) */
export type Timestamp = string;

export type JsonSerializable =
  | string
  | number
  | boolean
  | null
  | { [member: string]: JsonSerializable }
  | JsonSerializable[];

// TODO: Promotional Info Schema. We will use JSON object
export type PromotionalInfo = JsonSerializable;

// TODO: Use all generated UUIDs or use IDs from payment providers?
type IdType = string;

export type TopUpQuoteId = IdType;
export type PaymentReceiptId = IdType;
export type ChargebackReceiptId = IdType;

export type Amount = number;

// TODO: Define these types here? e.g: `'usd' | 'etc'`
export type CurrencyType = string;

// TODO: Define these types here? e.g: `'stripe' | 'apple-pay'`
export type PaymentProvider = string;

export interface User {
  userAddress: UserAddress;
  userAddressType: UserAddressType;
  winstonCreditBalance: WC;
  promotionalInfo: PromotionalInfo;
}

export interface TopUpQuote {
  topUpQuoteId: TopUpQuoteId;
  destinationAddress: UserAddress;
  destinationAddressType: UserAddressType;
  amount: Amount;
  currencyType: CurrencyType;
  winstonCreditAmount: WC;
  paymentProvider: PaymentProvider;
  quoteExpirationDate: Timestamp;
  quoteCreationDate: Timestamp;
}
export type CreateTopUpQuoteParams = Omit<TopUpQuote, "quoteCreationDate">;

export interface FulfilledTopUpQuote extends TopUpQuote {
  quoteFulfilledDate: Timestamp;
}

export interface FailedTopUpQuote extends TopUpQuote {
  quoteFailedDate: Timestamp;
}

export interface PaymentReceipt {
  paymentReceiptId: PaymentReceiptId;
  destinationAddress: UserAddress;
  destinationAddressType: UserAddressType;
  amount: Amount;
  currencyType: CurrencyType;
  winstonCreditAmount: WC;
  topUpQuoteId: TopUpQuoteId;
  paymentProvider: PaymentProvider;
  paymentReceiptDate: Timestamp;
}
export type CreatePaymentReceiptParams = Omit<
  PaymentReceipt,
  "paymentReceiptDate"
>;

export interface RescindedPaymentReceipt extends PaymentReceipt {
  paymentReceiptRescindedDate: Timestamp;
}

export interface ChargebackReceipt {
  chargebackReceiptId: ChargebackReceiptId;
  destinationAddress: UserAddress;
  destinationAddressType: UserAddressType;
  amount: Amount;
  currencyType: CurrencyType;
  winstonCreditAmount: WC;
  paymentReceiptId: PaymentReceiptId;
  paymentProvider: PaymentProvider;
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
}

export interface TopUpQuoteDBInsert {
  top_up_quote_id: string;
  destination_address: string;
  destination_address_type: string;
  amount: string;
  currency_type: string;
  winston_credit_amount: string;
  payment_provider: string;
  quote_expiration_date: string;
}
export interface TopUpQuoteDBResult extends TopUpQuoteDBInsert {
  quote_creation_date: string;
}

export type FulfilledTopUpQuoteDBInsert = TopUpQuoteDBResult;
export interface FulfilledTopUpQuoteDBResult
  extends FulfilledTopUpQuoteDBInsert {
  quote_fulfilled_date: string;
}

export type FailedTopUpQuoteDBInsert = TopUpQuoteDBResult;
export interface FailedTopUpQuoteDBResult extends FailedTopUpQuoteDBInsert {
  quote_failed_date: string;
}
export interface PaymentReceiptDBInsert {
  payment_receipt_id: string;
  destination_address: string;
  destination_address_type: string;
  amount: string;
  currency_type: string;
  winston_credit_amount: string;
  top_up_quote_id: string;
  payment_provider: string;
}
export interface PaymentReceiptDBResult extends PaymentReceiptDBInsert {
  payment_receipt_date: string;
}

export type RescindedPaymentReceiptDBInsert = PaymentReceiptDBResult;
export interface RescindedPaymentReceiptDBResult
  extends RescindedPaymentReceiptDBInsert {
  payment_receipt_rescinded_date: string;
}

export interface ChargebackReceiptDBInsert {
  chargeback_receipt_id: string;
  destination_address: string;
  destination_address_type: string;
  amount: string;
  currency_type: string;
  winston_credit_amount: string;
  payment_receipt_id: string;
  payment_provider: string;
  chargeback_reason: string;
}
export interface ChargebackReceiptDBResult extends ChargebackReceiptDBInsert {
  chargeback_receipt_date: string;
}
