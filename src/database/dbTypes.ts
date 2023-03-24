import { WC } from "../types/arc";

/** In this MVP this will be an Arweave Public Address */
export type UserAddress = string;

/** For MVP, this is: "arweave" */
export type UserAddressType = string;

/** Currently using Postgres Date type (ISO String without Timezone) */
export type Timestamp = string;

// TODO: Promotional Info Schema. We will use JSON object
export type PromotionalInfo = Record<string, unknown>;

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

export type CreateChargebackReceiptParams = Omit<
  ChargebackReceipt,
  "chargebackReceiptDate"
>;

export interface UserDBInsert {
  user_address: string;
  user_address_type: string;
  winston_credit_balance: string;
}
export interface UserDBResult extends UserDBInsert {
  // TODO: Type that comes back from postgres
  promotional_info: unknown;
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
