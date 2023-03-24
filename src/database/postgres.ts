import knex, { Knex } from "knex";
import winston from "winston";

import logger from "../logger";
import { Winston } from "../types/types";
import { Database } from "./database";
import { tableNames } from "./dbConstants";
import { paymentReceiptDBMap, topUpQuoteDBMap, userDBMap } from "./dbMaps";
import {
  CreatePaymentReceiptParams,
  CreateTopUpQuoteParams,
  PaymentReceipt,
  PaymentReceiptDBResult,
  PromotionalInfo,
  TopUpQuote,
  TopUpQuoteDBResult,
  User,
  UserDBResult,
} from "./dbTypes";
import * as knexConfig from "./knexfile";

/** Knex instance connected to a PostgreSQL database */
const pg = knex(knexConfig);
export class PostgresDatabase implements Database {
  private log: winston.Logger;

  constructor(private readonly knex: Knex = pg) {
    this.log = logger.child({ class: this.constructor.name });
  }

  public async createTopUpQuote(
    topUpQuote: CreateTopUpQuoteParams
  ): Promise<void> {
    this.log.info("Inserting new top up quote...", {
      topUpQuote,
    });

    const {
      amount,
      currencyType,
      destinationAddress,
      destinationAddressType,
      paymentProvider,
      quoteExpirationDate,
      topUpQuoteId,
      winstonCreditAmount,
    } = topUpQuote;

    await this.knex<TopUpQuoteDBResult>(tableNames.topUpQuote).insert({
      amount: amount.toString(),
      currency_type: currencyType,
      destination_address: destinationAddress,
      destination_address_type: destinationAddressType,
      payment_provider: paymentProvider,
      quote_expiration_date: quoteExpirationDate,
      top_up_quote_id: topUpQuoteId,
      winston_credit_amount: winstonCreditAmount.toString(),
    });
  }

  public async getTopUpQuote(topUpQuoteId: string): Promise<TopUpQuote> {
    return (
      await this.knex<TopUpQuoteDBResult>(tableNames.topUpQuote).where({
        top_up_quote_id: topUpQuoteId,
      })
    ).map(topUpQuoteDBMap)[0];
  }

  public async getPromoInfo(userAddress: string): Promise<PromotionalInfo> {
    return (await this.getUser(userAddress)).promotionalInfo;
  }

  public async getUser(userAddress: string): Promise<User> {
    return (
      await this.knex<UserDBResult>(tableNames.user).where({
        user_address: userAddress,
      })
    ).map(userDBMap)[0];
  }

  public async createPaymentReceipt(
    paymentReceipt: CreatePaymentReceiptParams
  ): Promise<void> {
    this.log.info("Inserting new payment receipt...", {
      paymentReceipt,
    });

    const {
      amount,
      currencyType,
      destinationAddress,
      destinationAddressType,
      paymentProvider,
      topUpQuoteId,
      paymentReceiptId,
      winstonCreditAmount,
    } = paymentReceipt;

    // TODO: Create user if none exists

    await this.knex<PaymentReceiptDBResult>(tableNames.paymentReceipt).insert({
      amount: amount.toString(),
      currency_type: currencyType,
      destination_address: destinationAddress,
      destination_address_type: destinationAddressType,
      payment_provider: paymentProvider,
      top_up_quote_id: topUpQuoteId,
      payment_receipt_id: paymentReceiptId,
      winston_credit_amount: winstonCreditAmount.toString(),
    });

    // TODO: Increment Balance of User
    // TODO: Mark Price Quote as Expired

    // TODO: Use a Transaction for all of these:
    // - Mark Expiration Date of Price Quote to Now
    // - Create User If not Exist, Increment The Balance
    // - Create Payment Receipt
  }

  public async getPaymentReceipt(
    paymentReceiptId: string
  ): Promise<PaymentReceipt> {
    return (
      await this.knex<PaymentReceiptDBResult>(tableNames.paymentReceipt).where({
        payment_receipt_id: paymentReceiptId,
      })
    ).map(paymentReceiptDBMap)[0];
  }

  public async reserveBalance(
    userAddress: string,
    winstonCreditAmount: Winston
  ): Promise<void> {
    await this.knex.transaction(async (knexTransaction) => {
      const user = (
        await knexTransaction<UserDBResult>(tableNames.user).where({
          user_address: userAddress,
        })
      ).map(userDBMap)[0];

      const currentWinstonBalance = user.winstonCreditBalance;
      let newBalance: Winston;

      try {
        newBalance = currentWinstonBalance.minus(winstonCreditAmount);
      } catch {
        throw Error("User does not have enough balance!");
      }

      await knexTransaction<UserDBResult>(tableNames.user)
        .where({
          user_address: userAddress,
        })
        .update({ winston_credit_balance: newBalance.toString() });
    });
  }

  public async refundBalance(
    userAddress: string,
    winstonCreditAmount: Winston
  ): Promise<void> {}
}
