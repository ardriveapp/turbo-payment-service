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
import { TransactionId } from "../types";
import { WC } from "../types/arc";
import {
  ChargebackReceipt,
  ChargebackReceiptId,
  CreateBalanceReservationParams,
  CreateBypassedPaymentReceiptParams,
  CreateChargebackReceiptParams,
  CreateNewCreditedTransactionParams,
  CreatePaymentReceiptParams,
  CreatePendingTransactionParams,
  CreateTopUpQuoteParams,
  CreditedPaymentTransaction,
  FailedPaymentTransaction,
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
  getBalance: (userAddress: UserAddress) => Promise<WC>;
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
    dataItemId?: TransactionId // TODO: once the upload-service is updated with the new routes, make this required
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
}
