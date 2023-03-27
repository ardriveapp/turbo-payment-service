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
  expireTopUpQuote: (topUpQuoteId: TopUpQuoteId) => Promise<void>;
  updatePromoInfo: (
    userAddress: UserAddress,
    promoInfo: PromotionalInfo
  ) => Promise<void>;
  getPromoInfo: (userAddress: UserAddress) => Promise<PromotionalInfo>;
  getUser: (userAddress: UserAddress) => Promise<User>;
  createPaymentReceipt: (
    paymentReceipt: CreatePaymentReceiptParams
  ) => Promise<void>;
  getPaymentReceipt: (
    paymentReceiptId: PaymentReceiptId
  ) => Promise<PaymentReceipt>;
  reserveBalance: (
    userAddress: UserAddress,
    winstonCreditAmount: WC
  ) => Promise<void>;
  refundBalance: (
    userAddress: UserAddress,
    winstonCreditAmount: WC
  ) => Promise<void>;
  createChargebackReceipt: (
    chargebackReceipt: CreateChargebackReceiptParams
  ) => Promise<void>;
  getChargebackReceipt: (
    chargebackReceiptId: ChargebackReceiptId
  ) => Promise<ChargebackReceipt>;
}
