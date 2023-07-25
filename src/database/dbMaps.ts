import { Winston } from "../types/winston";
import {
  APIAdjustment,
  Adjustment,
  AdjustmentApplicability,
  AdjustmentOperator,
  AdjustmentScope,
  AdjustmentUnit,
  ChargebackReceipt,
  ChargebackReceiptDBResult,
  FailedTopUpQuote,
  FailedTopUpQuoteDBResult,
  PaymentReceipt,
  PaymentReceiptDBResult,
  PriceAdjustment,
  PriceAdjustmentDBResult,
  PromotionalInfo,
  ThresholdOperator,
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

export function priceAdjustmentDBMap({
  adjustment_applicability,
  adjustment_description,
  adjustment_applicability_info,
  adjustment_threshold,
  adjustment_expiration_date,
  adjustment_id,
  adjustment_name,
  adjustment_operator,
  adjustment_priority,
  adjustment_start_date,
  adjustment_scope,
  adjustment_value,
}: PriceAdjustmentDBResult): PriceAdjustment {
  return {
    id: adjustment_id,
    name: adjustment_name,
    applicability: adjustment_applicability as AdjustmentApplicability,
    description: adjustment_description ?? undefined,
    applicabilityInfo: adjustment_applicability_info ?? undefined,
    scope: adjustment_scope as AdjustmentScope,
    threshold: adjustment_threshold
      ? {
          operator: adjustment_threshold.operator as ThresholdOperator,
          unit: adjustment_threshold.unit as AdjustmentUnit,
          value: adjustment_threshold.value,
        }
      : undefined,
    expirationDate: adjustment_expiration_date ?? undefined,
    operator: adjustment_operator as AdjustmentOperator,
    priority: adjustment_priority,
    startDate: adjustment_start_date,
    value: adjustment_value,
  };
}

export function adjustmentApiMap({
  adjustmentAmount,
  name,
  description,
  operator,
  value,
}: Adjustment): APIAdjustment {
  return {
    adjustmentAmount,
    name,
    description,
    operator,
    value,
  };
}
