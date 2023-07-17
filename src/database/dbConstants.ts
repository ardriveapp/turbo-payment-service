export const tableNames = {
  user: "user",
  topUpQuote: "top_up_quote",
  failedTopUpQuote: "failed_top_up_quote",
  paymentReceipt: "payment_receipt",
  chargebackReceipt: "chargeback_receipt",
  balanceReservation: "balance_reservation",
  finalizedReservation: "finalized_reservation",
  refundedReservation: "refunded_reservation",
  priceAdjustment: "price_adjustment",
  auditLog: "audit_log",
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

  // Balance reservation
  reservationId: "reservation_id", // Corresponding ID of Balance Used ( e.g: DataItemId )
  // user address
  reservedDate: "reserved_date",
  reservedWincAmount: "reserved_winc_amount", // amount reserved after adjustments
  adjustments: "adjustments", // array of AdjustmentID: AdjustmentAmount

  // Finalized reservation
  finalizedDate: "finalized_date",
  amortizedWincAmount: "amortized_winc_amount", // amount refunded by being bundled with other data items

  // Refunded reservation
  refundedDate: "refunded_date",
  refundedReason: "refunded_reason",

  // Price Adjustment
  adjustmentId: "adjustment_id",
  adjustmentName: "adjustment_name",
  adjustmentTarget: "adjustment_target", // e.g "upload" for on data uploads or "payment" on credit purchases
  adjustmentOperator: "adjustment_operator", // e.g "addition" || "multiply" || "free"
  adjustmentStartDate: "adjustment_start_date",
  adjustmentExpirationDate: "adjustment_expiration_date",

  // Audit Log
  auditId: "audit_id",
  auditDate: "audit_date",
  changeReason: "change_reason",
  changeId: "change_id",
} as const;
