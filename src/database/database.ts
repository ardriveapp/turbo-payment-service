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
import { TransactionId } from "../types";
import { WC } from "../types/arc";
import {
  ChargebackReceipt,
  ChargebackReceiptId,
  CreateBalanceReservationParams,
  CreateChargebackReceiptParams,
  CreatePaymentReceiptParams,
  CreateTopUpQuoteParams,
  PaymentAdjustmentCatalog,
  PaymentReceipt,
  PaymentReceiptId,
  PromotionalInfo,
  SingleUseCodePaymentCatalog,
  TopUpQuote,
  TopUpQuoteId,
  UnredeemedGift,
  UploadAdjustmentCatalog,
  User,
  UserAddress,
} from "./dbTypes";

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
  }) => Promise<User>;
}
