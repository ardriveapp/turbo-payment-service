import { TransactionId } from "../types";
import { WC } from "../types/arc";
import {
  ChargebackReceipt,
  ChargebackReceiptId,
  CreateChargebackReceiptParams,
  CreatePaymentReceiptParams,
  CreateTopUpQuoteParams,
  PaymentReceipt,
  PaymentReceiptId,
  PromotionalInfo,
  TopUpQuote,
  TopUpQuoteId,
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
  ) => Promise<void>;
  getPaymentReceipt: (
    paymentReceiptId: PaymentReceiptId
  ) => Promise<PaymentReceipt>;
  reserveBalance: (
    userAddress: UserAddress,
    winstonCreditAmount: WC,
    dataItemId?: TransactionId
  ) => Promise<void>;
  refundBalance: (
    userAddress: UserAddress,
    winstonCreditAmount: WC,
    dataItemId?: TransactionId
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
}
