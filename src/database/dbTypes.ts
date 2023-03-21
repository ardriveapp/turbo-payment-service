import { WC } from "../types/arc";

/** In this MVP this will be an Arweave Public Address */
export type UserAddress = string;

/** Currently using Postgres Date type (ISO String without Timezone) */
export type Timestamp = string;

// TODO: Promotional Info Schema. We will use JSON object
export type PromotionalInfo = Record<string, unknown>;

// TODO: Use all generated UUIDs or use IDs from payment providers?
type idType = string;

export type PriceQuoteId = idType;
export type PaymentReceiptId = idType;
export type ChargebackReceiptId = idType;

export type UsdAmount = number;
export type FiatAmount = number;

// TODO: Define these types here? e.g: `'usd' | 'etc'`
export type FiatIdentifier = string;

// TODO: Define these types here? e.g: `'stripe' | 'apple-pay'`
export type PaymentProvider = string;

export interface User {
  userAddress: UserAddress;
  winstonCreditBalance: WC;
  lastPaymentDate: Timestamp;
  lastUploadDate: Timestamp;
  promotionalInfo: PromotionalInfo;
}

export interface PriceQuote {
  priceQuoteId: PriceQuoteId;
  userAddress: UserAddress;
  usdAmount: UsdAmount;
  fiatAmount: FiatAmount;
  fiatIdentifier: FiatIdentifier;
  winstonCreditAmount: WC;
  paymentProvider: PaymentProvider;
  quoteExpirationDate: Timestamp;
  quoteCreationDate: Timestamp;
}

export interface PaymentReceipt {
  paymentReceiptId: PaymentReceiptId;
  userAddress: UserAddress;
  usdAmount: UsdAmount;
  fiatAmount: FiatAmount;
  fiatIdentifier: FiatIdentifier;
  winstonCreditAmount: WC;
  priceQuoteId: PriceQuoteId;
  paymentProvider: PaymentProvider;
  paymentReceiptDate: Timestamp;
}

export interface ChargebackReceipt {
  chargebackReceiptId: ChargebackReceiptId;
  userAddress: UserAddress;
  usdAmount: UsdAmount;
  winstonCreditAmount: WC;
  paymentReceiptId: PaymentReceiptId;
  paymentProvider: PaymentProvider;
  chargebackReason: string;
  chargebackReceiptDate: Timestamp;
}

export interface UserDBInsert {
  user_address: string;
  winston_credit_balance: string;
}
export interface UserDBResult extends UserDBInsert {
  last_payment_date: string;
  last_upload_date: string;
  // TODO: Type that comes back from postgres
  promotional_info: unknown;
}

export interface PriceQuoteDBInsert {
  price_quote_id: string;
  user_address: string;
  usd_amount: string;
  fiat_amount: string;
  fiat_identifier: string;
  winston_credit_amount: string;
  payment_provider: string;
  quote_expiration_date: string;
}
export interface PriceQuoteDBResult extends PriceQuoteDBInsert {
  quote_creation_date: string;
}

export interface PaymentReceiptDBInsert {
  payment_receipt_id: string;
  user_address: string;
  usd_amount: string;
  fiat_amount: string;
  fiat_identifier: string;
  winston_credit_amount: string;
  price_quote_id: string;
  payment_provider: string;
}
export interface PaymentReceiptDBResult extends PaymentReceiptDBInsert {
  payment_receipt_date: string;
}

export interface ChargebackReceiptDBInsert {
  chargeback_receipt_id: string;
  user_address: string;
  usd_amount: string;
  winston_credit_amount: string;
  payment_receipt_id: string;
  payment_provider: string;
  chargeback_reason: string;
}
export interface ChargebackReceiptDBResult extends ChargebackReceiptDBInsert {
  chargeback_receipt_date: string;
}
