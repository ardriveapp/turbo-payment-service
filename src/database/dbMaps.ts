/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { Winston } from "../types/winston";
import {
  AdjustmentCatalog,
  AdjustmentCatalogDBResult,
  ChargebackReceipt,
  ChargebackReceiptDBResult,
  FailedTopUpQuote,
  FailedTopUpQuoteDBResult,
  PaymentAdjustmentCatalog,
  PaymentAdjustmentCatalogDBResult,
  PaymentReceipt,
  PaymentReceiptDBResult,
  PromotionalInfo,
  SingleUseCodePaymentCatalog,
  SingleUseCodePaymentCatalogDBResult,
  TopUpQuote,
  TopUpQuoteDBResult,
  UploadAdjustmentCatalog,
  UploadAdjustmentCatalogDBResult,
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
  quoted_payment_amount,
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
    quotedPaymentAmount: +quoted_payment_amount,
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

function priceAdjustmentCatalogDBMap({
  catalog_id,
  adjustment_name,
  adjustment_description,
  operator,
  operator_magnitude,
  adjustment_priority,
  adjustment_start_date,
  adjustment_end_date,
}: AdjustmentCatalogDBResult): AdjustmentCatalog {
  return {
    catalogId: catalog_id,
    name: adjustment_name,
    description: adjustment_description,
    startDate: adjustment_start_date,
    endDate: adjustment_end_date,
    priority: adjustment_priority,
    operator,
    operatorMagnitude: +operator_magnitude,
  };
}

export function uploadAdjustmentCatalogDBMap(
  dbResult: UploadAdjustmentCatalogDBResult
): UploadAdjustmentCatalog {
  return priceAdjustmentCatalogDBMap(dbResult);
}

export function paymentAdjustmentCatalogDBMap(
  dbResult: PaymentAdjustmentCatalogDBResult
): PaymentAdjustmentCatalog {
  return {
    ...priceAdjustmentCatalogDBMap(dbResult),
    exclusivity: dbResult.adjustment_exclusivity,
  };
}

export function singleUseCodePaymentCatalogDBMap(
  dbResult: SingleUseCodePaymentCatalogDBResult
): SingleUseCodePaymentCatalog {
  return {
    ...paymentAdjustmentCatalogDBMap(dbResult),
    codeValue: dbResult.code_value,
    targetUserGroup: dbResult.target_user_group,
    maxUses: dbResult.max_uses,
    minimumPaymentAmount: dbResult.minimum_payment_amount,
    maximumDiscountAmount: dbResult.maximum_discount_amount,
  };
}
