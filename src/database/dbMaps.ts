import { Winston } from "../types/winston";
import {
  ChargebackReceipt,
  ChargebackReceiptDBResult,
  PaymentReceipt,
  PaymentReceiptDBResult,
  PriceQuote,
  PriceQuoteDBResult,
  PromotionalInfo,
  User,
  UserDBResult,
} from "./dbTypes";

export function userDBMap({
  last_payment_date,
  last_upload_date,
  promotional_info,
  user_address,
  winston_credit_balance,
}: UserDBResult): User {
  return {
    lastPaymentDate: last_payment_date,
    lastUploadDate: last_upload_date,
    promotionalInfo: promotional_info as PromotionalInfo,
    userAddress: user_address,
    winstonCreditBalance: new Winston(winston_credit_balance),
  };
}

export function priceQuoteDBMap({
  fiat_amount,
  fiat_identifier,
  payment_provider,
  price_quote_id,
  quote_creation_date,
  quote_expiration_date,
  usd_amount,
  user_address,
  winston_credit_amount,
}: PriceQuoteDBResult): PriceQuote {
  return {
    fiatAmount: +fiat_amount,
    fiatIdentifier: fiat_identifier,
    paymentProvider: payment_provider,
    priceQuoteId: price_quote_id,
    quoteCreationDate: quote_creation_date,
    quoteExpirationDate: quote_expiration_date,
    usdAmount: +usd_amount,
    userAddress: user_address,
    winstonCreditAmount: new Winston(winston_credit_amount),
  };
}

export function PaymentReceiptDBMap({
  fiat_amount,
  fiat_identifier,
  payment_provider,
  payment_receipt_date,
  payment_receipt_id,
  price_quote_id,
  usd_amount,
  user_address,
  winston_credit_amount,
}: PaymentReceiptDBResult): PaymentReceipt {
  return {
    fiatAmount: +fiat_amount,
    fiatIdentifier: fiat_identifier,
    paymentProvider: payment_provider,
    paymentReceiptDate: payment_receipt_date,
    paymentReceiptId: payment_receipt_id,
    priceQuoteId: price_quote_id,
    usdAmount: +usd_amount,
    userAddress: user_address,
    winstonCreditAmount: new Winston(winston_credit_amount),
  };
}

export function ChargebackReceiptDBMap({
  payment_provider,
  chargeback_receipt_date,
  chargeback_receipt_id,
  chargeback_reason,
  payment_receipt_id,
  usd_amount,
  user_address,
  winston_credit_amount,
}: ChargebackReceiptDBResult): ChargebackReceipt {
  return {
    paymentProvider: payment_provider,
    chargebackReceiptDate: chargeback_receipt_date,
    chargebackReason: chargeback_reason,
    chargebackReceiptId: chargeback_receipt_id,
    paymentReceiptId: payment_receipt_id,
    usdAmount: +usd_amount,
    userAddress: user_address,
    winstonCreditAmount: new Winston(winston_credit_amount),
  };
}
