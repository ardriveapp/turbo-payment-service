export const tableNames = {
  user: "user",
  topUpQuote: "top_up_quote",
  failedTopUpQuote: "failed_top_up_quote",
  paymentReceipt: "payment_receipt",
  chargebackReceipt: "chargeback_receipt",
  // TODO: Do we use audit log table for accountability during disputes (see tech design)
  // auditLog: "audit_log",
} as const;

export const columnNames = {
  // User
  userAddress: "user_address",
  userAddressType: "user_address_type",
  userCreationDate: "user_creation_date",
  winstonCreditBalance: "winston_credit_balance",
  promotionalInfo: "promotional_info",

  // Top up quote
  topUpQuoteId: "top_up_quote_id",
  destinationAddress: "destination_address",
  destinationAddressType: "destination_address_type",
  paymentAmount: "payment_amount",
  currencyType: "currency_type",
  winstonCreditAmount: "winston_credit_amount",
  quoteExpirationDate: "quote_expiration_date",
  quoteCreationDate: "quote_creation_date",
  paymentProvider: "payment_provider",

  // Failed top up quote
  failedReason: "failed_reason",
  quoteFailedDate: "quote_failed_date",

  // Payment receipt
  paymentReceiptId: "payment_receipt_id",
  paymentReceiptDate: "payment_receipt_date",

  // Chargeback receipt
  chargebackReceiptId: "chargeback_receipt_id",
  chargebackReason: "chargeback_reason",
  chargebackReceiptDate: "chargeback_receipt_date",
} as const;
