import { Winston } from "../types/winston";
import {
  ChargebackReceipt,
  ChargebackReceiptDBResult,
  FailedTopUpQuote,
  FailedTopUpQuoteDBResult,
  PaymentReceipt,
  PaymentReceiptDBResult,
  PromotionalInfo,
  TopUpQuote,
  TopUpQuoteDBResult,
  User,
  UserDBResult,
} from "./dbTypes";

export function userDBMap({
  promotional_info,
  user_address,
  user_creation_date,
  winston_credit_balance,
  user_address_type,
}: UserDBResult): User {
  return {
    promotionalInfo: promotional_info as PromotionalInfo,
    userAddress: user_address,
    userAddressType: user_address_type,
    userCreationDate: user_creation_date,
    winstonCreditBalance: new Winston(winston_credit_balance),
  };
}

export function topUpQuoteDBMap({
  payment_amount,
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
    paymentAmount: +payment_amount,
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

export function failedTopUpQuoteDBMap(
  dbResult: FailedTopUpQuoteDBResult
): FailedTopUpQuote {
  return {
    ...topUpQuoteDBMap(dbResult),
    failedReason: dbResult.failed_reason,
    quoteFailedDate: dbResult.quote_failed_date,
  };
}

export function paymentReceiptDBMap(
  dbResult: PaymentReceiptDBResult
): PaymentReceipt {
  return {
    ...topUpQuoteDBMap(dbResult),
    paymentReceiptDate: dbResult.payment_receipt_date,
    paymentReceiptId: dbResult.payment_receipt_id,
  };
}

export function chargebackReceiptDBMap(
  dbResult: ChargebackReceiptDBResult
): ChargebackReceipt {
  return {
    ...paymentReceiptDBMap(dbResult),
    chargebackReceiptDate: dbResult.chargeback_receipt_date,
    chargebackReason: dbResult.chargeback_reason,
    chargebackReceiptId: dbResult.chargeback_receipt_id,
  };
}
