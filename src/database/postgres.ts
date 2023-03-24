import knex, { Knex } from "knex";
import winston from "winston";

import logger from "../logger";
import { Winston } from "../types/types";
import { Database } from "./database";
import { tableNames } from "./dbConstants";
import { topUpQuoteDBMap } from "./dbMaps";
import {
  CreatePaymentReceiptParams,
  CreateTopUpQuoteParams,
  PaymentReceipt,
  PromotionalInfo,
  TopUpQuote,
  TopUpQuoteDBResult,
  User,
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

  public async getPromoInfo(userAddress: string): Promise<PromotionalInfo> {}

  public async getUser(userAddress: string): Promise<User> {}

  public async createPaymentReceipt(
    paymentReceipt: CreatePaymentReceiptParams
  ): Promise<void> {}

  public async getPaymentReceipt(
    paymentReceiptId: string
  ): Promise<PaymentReceipt> {}

  public async reserveBalance(
    userAddress: string,
    winstonCreditAmount: Winston
  ): Promise<void> {}

  public async refundBalance(
    userAddress: string,
    winstonCreditAmount: Winston
  ): Promise<void> {}
}
