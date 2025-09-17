/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
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
import { Knex } from "knex";

import { TransactionId } from "../types";
import { WC } from "../types/arc";
import {
  ArNSPurchase,
  ArNSPurchaseParams,
  ArNSPurchaseQuote,
  ArNSPurchaseQuoteParams,
  ArNSPurchaseStatusResult,
  ChargebackReceipt,
  ChargebackReceiptId,
  CreateBalanceReservationParams,
  CreateBypassedPaymentReceiptParams,
  CreateChargebackReceiptParams,
  CreateDelegatedPaymentApprovalParams,
  CreateNewCreditedTransactionParams,
  CreatePaymentReceiptParams,
  CreatePendingTransactionParams,
  CreateTopUpQuoteParams,
  CreditedPaymentTransaction,
  DataItemId,
  DelegatedPaymentApproval,
  FailedPaymentTransaction,
  GetBalanceResult,
  IntervalUnit,
  PaymentAdjustmentCatalog,
  PaymentReceipt,
  PaymentReceiptId,
  PendingPaymentTransaction,
  PromotionalInfo,
  SingleUseCodePaymentCatalog,
  TopUpQuote,
  TopUpQuoteId,
  UnredeemedGift,
  UploadAdjustmentCatalog,
  User,
  UserAddress,
  UserAddressType,
} from "./dbTypes";

export type WincUsedForUploadAdjustmentParams = {
  userAddress: string;
  catalogId: string;
  limitationInterval: number;
  limitationIntervalUnit: IntervalUnit;
};

export interface Database {
  createTopUpQuote: (topUpQuote: CreateTopUpQuoteParams) => Promise<void>;

  getTopUpQuote: (topUpQuoteId: TopUpQuoteId) => Promise<TopUpQuote>;

  updatePromoInfo: (
    userAddress: UserAddress,
    promoInfo: PromotionalInfo
  ) => Promise<void>;

  getPromoInfo: (userAddress: UserAddress) => Promise<PromotionalInfo>;

  getUser: (userAddress: UserAddress) => Promise<User>;

  getBalance: (userAddress: UserAddress) => Promise<GetBalanceResult>;

  createPaymentReceipt: (
    paymentReceipt: CreatePaymentReceiptParams
  ) => Promise<void | UnredeemedGift>;

  createBypassedPaymentReceipts(
    paymentReceipts: CreateBypassedPaymentReceiptParams[]
  ): Promise<UnredeemedGift[]>;

  getPaymentReceipt: (
    paymentReceiptId: PaymentReceiptId
  ) => Promise<PaymentReceipt>;

  reserveBalance: (
    createBalanceReservationParams: CreateBalanceReservationParams
  ) => Promise<void>;

  refundBalance: (
    userAddress: UserAddress,
    winstonCreditAmount: WC,
    dataItemId: TransactionId
  ) => Promise<void>;

  createChargebackReceipt: (
    createChargebackReceiptParams: CreateChargebackReceiptParams
  ) => Promise<void>;

  getChargebackReceiptsForAddress: (
    userAddress: UserAddress
  ) => Promise<ChargebackReceipt[]>;

  getChargebackReceipt: (
    chargebackReceiptId: ChargebackReceiptId
  ) => Promise<ChargebackReceipt>;

  checkForExistingPaymentByTopUpQuoteId: (
    topUpQuoteId: TopUpQuoteId
  ) => Promise<boolean>;

  getSingleUsePromoCodeAdjustments: (
    promoCodes: string[],
    userAddress: UserAddress
  ) => Promise<SingleUseCodePaymentCatalog[]>;

  getUploadAdjustmentCatalogs: () => Promise<UploadAdjustmentCatalog[]>;

  getPaymentAdjustmentCatalogs(): Promise<PaymentAdjustmentCatalog[]>;

  redeemGift: (params: {
    paymentReceiptId: string;
    recipientEmail: string;
    destinationAddress: string;
    destinationAddressType: UserAddressType;
  }) => Promise<{ user: User; wincRedeemed: WC }>;

  /**
   * Creates a pending_payment_transaction where we found and validated the
   * incoming payment transaction, but are waiting more blocks to confirm
   */
  createPendingTransaction: (
    params: CreatePendingTransactionParams
  ) => Promise<void>;

  /**
   * Creates a credited_payment_transaction where the block_height is already confirmed
   * This will credit a user's balance and add a payment notation to the audit log
   */
  createNewCreditedTransaction: (
    params: CreateNewCreditedTransactionParams
  ) => Promise<void>;

  /** Get all `new` and `pending` payment transactions for processing credited/failed payments */
  getPendingTransactions: () => Promise<PendingPaymentTransaction[]>;

  /** Get any existing payment transaction from the the database */
  checkForPendingTransaction: (
    transactionId: TransactionId
  ) => Promise<
    | PendingPaymentTransaction
    | FailedPaymentTransaction
    | CreditedPaymentTransaction
    | false
  >;

  /**
   * Credit a pending_payment_transaction where the block_height has been confirmed
   */
  creditPendingTransaction: (
    transactionId: TransactionId,
    blockHeight: number
  ) => Promise<void>;

  /**
   * Fail a pending_payment_transaction where the transaction was no longer found in a block
   */
  failPendingTransaction: (
    transactionId: TransactionId,
    failedReason: string
  ) => Promise<void>;

  getWincUsedForUploadAdjustmentCatalog(
    params: WincUsedForUploadAdjustmentParams
  ): Promise<WC>;

  createDelegatedPaymentApproval: (
    params: CreateDelegatedPaymentApprovalParams
  ) => Promise<DelegatedPaymentApproval>;

  revokeDelegatedPaymentApprovals: (params: {
    payingAddress: UserAddress;
    approvedAddress: UserAddress;
    revokeDataItemId: DataItemId;
  }) => Promise<DelegatedPaymentApproval[]>;

  getApprovalsFromPayerForAddress: (
    params: { payingAddress: UserAddress; approvedAddress: UserAddress },
    knexTransaction?: Knex.Transaction
  ) => Promise<DelegatedPaymentApproval[]>;

  getAllApprovalsForUserAddress: (userAddress: string) => Promise<{
    givenApprovals: DelegatedPaymentApproval[];
    receivedApprovals: DelegatedPaymentApproval[];
  }>;

  createArNSPurchaseReceipt: (
    createPendingArNSPurchaseParams: ArNSPurchaseParams
  ) => Promise<ArNSPurchase>;

  addMessageIdToPurchaseReceipt: (p: {
    nonce: string;
    messageId: string;
  }) => Promise<void>;

  updateFailedArNSPurchase: (
    nonce: string,
    failedReason: string
  ) => Promise<void>;

  getArNSPurchaseStatus: (
    nonce: string
  ) => Promise<ArNSPurchaseStatusResult | undefined>;

  createArNSPurchaseQuote: (
    params: ArNSPurchaseQuoteParams
  ) => Promise<ArNSPurchaseQuote>;

  getArNSPurchaseQuote: (
    nonce: string
  ) => Promise<{ quote: ArNSPurchaseQuote }>;
  updateArNSPurchaseQuoteToSuccess: (p: {
    nonce: string;
    messageId: string;
  }) => Promise<void>;
  updateArNSPurchaseQuoteToFailure: (
    nonce: string,
    failedReason: string
  ) => Promise<void>;
}
