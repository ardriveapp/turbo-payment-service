import { WC } from "../types/arc";
import { PublicArweaveAddress } from "../types/types";

export type UserAddress = string | PublicArweaveAddress;
export type UserAddressType = string | "arweave";

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
  winstonCreditBalance: WC;
  promotionalInfo: PromotionalInfo;
}

interface BaseQuote {
  topUpQuoteId: TopUpQuoteId;
  destinationAddress: UserAddress;
  destinationAddressType: UserAddressType;
  amount: PaymentAmount;
  currencyType: CurrencyType;
  winstonCreditAmount: WC;
  paymentProvider: PaymentProvider;
}

export interface TopUpQuote extends BaseQuote {
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

export interface PaymentReceipt extends BaseQuote {
  paymentReceiptId: PaymentReceiptId;
  paymentReceiptDate: Timestamp;
}
export type CreatePaymentReceiptParams = Omit<
  PaymentReceipt,
  "paymentReceiptDate"
>;

export interface RescindedPaymentReceipt extends PaymentReceipt {
  paymentReceiptRescindedDate: Timestamp;
}

export interface ChargebackReceipt extends CreatePaymentReceiptParams {
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
}

export interface BaseQuoteInsert {
  top_up_quote_id: string;
  destination_address: string;
  destination_address_type: string;
  amount: string;
  currency_type: string;
  winston_credit_amount: string;
  payment_provider: string;
}

export interface TopUpQuoteDBInsert extends BaseQuoteInsert {
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
export interface PaymentReceiptDBInsert extends BaseQuoteInsert {
  payment_receipt_id: string;
}
export interface PaymentReceiptDBResult extends PaymentReceiptDBInsert {
  payment_receipt_date: string;
}

export type RescindedPaymentReceiptDBInsert = PaymentReceiptDBResult;
export interface RescindedPaymentReceiptDBResult
  extends RescindedPaymentReceiptDBInsert {
  payment_receipt_rescinded_date: string;
}

export interface ChargebackReceiptDBInsert extends PaymentReceiptDBInsert {
  chargeback_receipt_id: string;
  chargeback_reason: string;
}
export interface ChargebackReceiptDBResult extends ChargebackReceiptDBInsert {
  chargeback_receipt_date: string;
}
