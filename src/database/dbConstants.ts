export const tableNames = {
  user: "user",
  topUpQuote: "top_up_quote",
  fulfilledTopUpQuote: "fulfilled_top_up_quote",
  failedTopUpQuote: "failed_top_up_quote",
  paymentReceipt: "payment_receipt",
  rescindedPaymentReceipt: "rescinded_payment_receipt",
  chargebackReceipt: "chargeback_receipt",
  // TODO: Do we use audit log table for accountability during disputes (see tech design)
  // auditLog: "audit_log",
} as const;

export const columnNames = {
  userAddress: "user_address",
  userAddressType: "user_address_type",
  destinationAddress: "destination_address",
  destinationAddressType: "destination_address_type",
  winstonCreditBalance: "winston_credit_balance",
  promotionalInfo: "promotional_info",
  topUpQuoteId: "top_up_quote_id",
  amount: "amount",
  currencyType: "currency_type",
  winstonCreditAmount: "winston_credit_amount",
  quoteExpirationDate: "quote_expiration_date",
  quoteCreationDate: "quote_creation_date",
  quoteFulfilledDate: "quote_fulfilled_date",
  quoteFailedDate: "quote_failed_date",
  paymentProvider: "payment_provider",
  paymentReceiptId: "payment_receipt_id",
  paymentReceiptDate: "payment_receipt_date",
  paymentReceiptRescindedDate: "payment_receipt_rescinded_date",
  chargebackReceiptId: "chargeback_receipt_id",
  chargebackReason: "chargeback_reason",
  chargebackReceiptDate: "chargeback_receipt_date",
} as const;
