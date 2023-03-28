import { Winston } from "../types/winston";
import {
  ChargebackReceipt,
  ChargebackReceiptDBResult,
  FailedTopUpQuote,
  FailedTopUpQuoteDBResult,
  FulfilledTopUpQuote,
  FulfilledTopUpQuoteDBResult,
  PaymentReceipt,
  PaymentReceiptDBResult,
  PromotionalInfo,
  RescindedPaymentReceipt,
  RescindedPaymentReceiptDBResult,
  TopUpQuote,
  TopUpQuoteDBResult,
  User,
  UserDBResult,
} from "./dbTypes";

export function userDBMap({
  promotional_info,
  user_address,
  winston_credit_balance,
  user_address_type,
}: UserDBResult): User {
  return {
    promotionalInfo: promotional_info as PromotionalInfo,
    userAddress: user_address,
    userAddressType: user_address_type,
    winstonCreditBalance: new Winston(winston_credit_balance),
  };
}

export function topUpQuoteDBMap({
  amount,
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
    amount: +amount,
    currencyType: currency_type,
    paymentProvider: payment_provider,
    topUpQuoteId: top_up_quote_id,
    quoteCreationDate: quote_creation_date,
    quoteExpirationDate: quote_expiration_date,
    destinationAddress: destination_address,
    destinationAddressType: destination_address_type,
    winstonCreditAmount: new Winston(winston_credit_amount),
  };
}

export function fulfilledTopUpQuoteDBMap(
  dbResult: FulfilledTopUpQuoteDBResult
): FulfilledTopUpQuote {
  return {
    ...topUpQuoteDBMap(dbResult),
    quoteFulfilledDate: dbResult.quote_fulfilled_date,
  };
}

export function failedTopUpQuoteDBMap(
  dbResult: FailedTopUpQuoteDBResult
): FailedTopUpQuote {
  return {
    ...topUpQuoteDBMap(dbResult),
    quoteFailedDate: dbResult.quote_failed_date,
  };
}

export function paymentReceiptDBMap({
  amount,
  currency_type,
  payment_provider,
  payment_receipt_date,
  payment_receipt_id,
  top_up_quote_id,
  winston_credit_amount,
  destination_address,
  destination_address_type,
}: PaymentReceiptDBResult): PaymentReceipt {
  return {
    paymentProvider: payment_provider,
    paymentReceiptDate: payment_receipt_date,
    paymentReceiptId: payment_receipt_id,
    topUpQuoteId: top_up_quote_id,
    amount: +amount,
    currencyType: currency_type,
    destinationAddress: destination_address,
    destinationAddressType: destination_address_type,
    winstonCreditAmount: new Winston(winston_credit_amount),
  };
}

export function rescindedPaymentReceiptDBMap(
  dbResult: RescindedPaymentReceiptDBResult
): RescindedPaymentReceipt {
  return {
    ...paymentReceiptDBMap(dbResult),
    paymentReceiptRescindedDate: dbResult.payment_receipt_rescinded_date,
  };
}

export function chargebackReceiptDBMap({
  payment_provider,
  chargeback_receipt_date,
  chargeback_receipt_id,
  chargeback_reason,
  payment_receipt_id,
  amount,
  currency_type,
  destination_address,
  destination_address_type,
  top_up_quote_id,
  winston_credit_amount,
}: ChargebackReceiptDBResult): ChargebackReceipt {
  return {
    paymentProvider: payment_provider,
    chargebackReceiptDate: chargeback_receipt_date,
    chargebackReason: chargeback_reason,
    chargebackReceiptId: chargeback_receipt_id,
    paymentReceiptId: payment_receipt_id,
    amount: +amount,
    currencyType: currency_type,
    destinationAddress: destination_address,
    destinationAddressType: destination_address_type,
    topUpQuoteId: top_up_quote_id,
    winstonCreditAmount: new Winston(winston_credit_amount),
  };
}
