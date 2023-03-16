export const tableNames = {
  user: "user",
  priceQuote: "price_quote",
  paymentReceipt: "payment_receipt",
  chargebackReceipt: "chargeback_receipt",
  // TODO: Do we use audit log table for accountability during disputes (see tech design)
  // auditLog: "audit_log",
} as const;

export const columnNames = {
  userAddress: "user_address",
  winstonCreditBalance: "winston_credit_balance",
  lastPaymentDate: "last_payment_date",
  lastUploadDate: "last_upload_date",
  promotionalInfo: "promotional_info",
  priceQuoteId: "price_quote_id",
  usdAmount: "usd_amount",
  winstonCreditAmount: "winston_credit_amount",
  quoteExpirationDate: "quote_expiration_date",
  quoteCreationDate: "quote_creation_date",
  paymentProvider: "payment_provider",
  paymentReceiptId: "payment_receipt_id",
  paymentReceiptDate: "payment_receipt_date",
  chargebackReceiptId: "chargeback_receipt_id",
  chargebackReason: "chargeback_reason",
  chargebackReceiptDate: "chargeback_receipt_date",
} as const;
