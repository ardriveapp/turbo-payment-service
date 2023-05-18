import knex, { Knex } from "knex";
import winston from "winston";

import logger from "../logger";
import { WC, Winston } from "../types/types";
import { Database } from "./database";
import { columnNames, tableNames } from "./dbConstants";
import {
  chargebackReceiptDBMap,
  paymentReceiptDBMap,
  topUpQuoteDBMap,
  userDBMap,
} from "./dbMaps";
import {
  ChargebackReceipt,
  ChargebackReceiptDBResult,
  CreateChargebackReceiptParams,
  CreatePaymentReceiptParams,
  CreateTopUpQuoteParams,
  FailedTopUpQuoteDBResult,
  PaymentReceipt,
  PaymentReceiptDBResult,
  PromotionalInfo,
  TopUpQuote,
  TopUpQuoteDBResult,
  User,
  UserDBResult,
} from "./dbTypes";
import { InsufficientBalance, UserNotFoundWarning } from "./errors";
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
      paymentAmount,
      currencyType,
      destinationAddress,
      destinationAddressType,
      paymentProvider,
      quoteExpirationDate,
      topUpQuoteId,
      winstonCreditAmount,
    } = topUpQuote;

    await this.knex<TopUpQuoteDBResult>(tableNames.topUpQuote).insert({
      payment_amount: paymentAmount.toString(),
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
    const topUpQuoteDbResult = await this.knex<TopUpQuoteDBResult>(
      tableNames.topUpQuote
    ).where({
      [columnNames.topUpQuoteId]: topUpQuoteId,
    });
    if (topUpQuoteDbResult.length === 0) {
      throw Error(
        `No top up quote found in database with ID '${topUpQuoteId}'`
      );
    }

    return topUpQuoteDbResult.map(topUpQuoteDBMap)[0];
  }

  public async updatePromoInfo(
    userAddress: string,
    promoInfo: PromotionalInfo
  ): Promise<void> {
    await this.knex.transaction(async (knexTransaction) => {
      await this.getUser(userAddress, knexTransaction);

      await knexTransaction<UserDBResult>(tableNames.user)
        .where({
          user_address: userAddress,
        })
        .update({ promotional_info: promoInfo });
    });
  }

  public async getPromoInfo(userAddress: string): Promise<PromotionalInfo> {
    const promoInfo = (await this.getUser(userAddress)).promotionalInfo;
    logger.info("promo info:", { type: typeof promoInfo, promoInfo });
    return promoInfo;
  }

  public async getUser(
    userAddress: string,
    knexTransaction: Knex.Transaction = this.knex as Knex.Transaction
  ): Promise<User> {
    const userDbResult = await knexTransaction<UserDBResult>(
      tableNames.user
    ).where({
      user_address: userAddress,
    });

    if (userDbResult.length === 0) {
      throw new UserNotFoundWarning(userAddress);
    }

    return userDbResult.map(userDBMap)[0];
  }

  public async getBalance(userAddress: string): Promise<WC> {
    return (await this.getUser(userAddress)).winstonCreditBalance;
  }

  public async createPaymentReceipt(
    paymentReceipt: CreatePaymentReceiptParams
  ): Promise<void> {
    this.log.info("Inserting new payment receipt...", {
      paymentReceipt,
    });

    const { topUpQuoteId, paymentReceiptId, paymentAmount, currencyType } =
      paymentReceipt;

    await this.knex.transaction(async (knexTransaction) => {
      const topUpQuoteDbResults = await knexTransaction<TopUpQuoteDBResult>(
        tableNames.topUpQuote
      ).where({
        top_up_quote_id: topUpQuoteId,
      });
      if (topUpQuoteDbResults.length === 0) {
        throw Error(
          `No top up quote found in database with id '${topUpQuoteId}'`
        );
      }

      const {
        payment_amount,
        currency_type,
        destination_address,
        destination_address_type,
        winston_credit_amount,
        quote_expiration_date,
      } = topUpQuoteDbResults[0];

      if (new Date(quote_expiration_date).getTime() < new Date().getTime()) {
        throw Error(
          `Top up quote with id '${topUpQuoteId}' has already been expired!`
        );
      }

      if (paymentAmount < +payment_amount || currencyType !== currency_type) {
        throw Error(
          `Amount from top up quote (${payment_amount} ${currency_type}) does not match the amount paid on the payment receipt (${paymentAmount} ${currencyType})!`
        );
      }

      // Delete top up quote
      const topUpQuote = await knexTransaction<TopUpQuoteDBResult>(
        tableNames.topUpQuote
      )
        .where({
          top_up_quote_id: topUpQuoteId,
        })
        .del()
        .returning("*");

      // Re-insert as payment receipt
      await knexTransaction<PaymentReceiptDBResult>(
        tableNames.paymentReceipt
      ).insert({ ...topUpQuote[0], payment_receipt_id: paymentReceiptId });

      const destinationUser = (
        await knexTransaction<UserDBResult>(tableNames.user).where({
          user_address: destination_address,
        })
      )[0];
      if (destinationUser === undefined) {
        logger.info("No existing user was found; creating new user...", {
          userAddress: destination_address,
          newBalance: winston_credit_amount,
          paymentReceipt,
        });
        await knexTransaction<UserDBResult>(tableNames.user).insert({
          user_address: destination_address,
          user_address_type: destination_address_type,
          winston_credit_balance: winston_credit_amount,
        });
      } else {
        // Increment balance of existing user
        const currentBalance = new Winston(
          destinationUser.winston_credit_balance
        );
        const newBalance = currentBalance.plus(
          new Winston(winston_credit_amount)
        );

        logger.info("Incrementing balance...", {
          userAddress: destination_address,
          currentBalance,
          newBalance,
          paymentReceipt,
        });
        await knexTransaction<UserDBResult>(tableNames.user)
          .where({
            user_address: destination_address,
          })
          .update({ winston_credit_balance: newBalance.toString() });
      }
    });
  }

  public async getPaymentReceipt(
    paymentReceiptId: string,
    knexTransaction: Knex.Transaction = this.knex as Knex.Transaction
  ): Promise<PaymentReceipt> {
    return this.getPaymentReceiptWhere(
      { [columnNames.paymentReceiptId]: paymentReceiptId },
      knexTransaction
    );
  }

  private async getPaymentReceiptByTopUpQuoteId(
    topUpQuoteId: string,
    knexTransaction: Knex.Transaction = this.knex as Knex.Transaction
  ): Promise<PaymentReceipt> {
    return this.getPaymentReceiptWhere(
      { [columnNames.topUpQuoteId]: topUpQuoteId },
      knexTransaction
    );
  }

  private async getPaymentReceiptWhere(
    where: Partial<PaymentReceiptDBResult>,
    knexTransaction: Knex.Transaction = this.knex as Knex.Transaction
  ): Promise<PaymentReceipt> {
    const paymentReceiptDbResults =
      await knexTransaction<PaymentReceiptDBResult>(
        tableNames.paymentReceipt
      ).where(where);

    if (paymentReceiptDbResults.length === 0) {
      throw Error(
        `No payment receipts found in database with query ${JSON.stringify(
          where
        )}!`
      );
    }

    return paymentReceiptDbResults.map(paymentReceiptDBMap)[0];
  }

  public async createChargebackReceipt({
    topUpQuoteId,
    chargebackReason,
    chargebackReceiptId,
  }: CreateChargebackReceiptParams): Promise<void> {
    this.log.info("Inserting new chargeback receipt...", {
      topUpQuoteId,
    });

    await this.knex.transaction(async (knexTransaction) => {
      // This will throw if payment receipt does not exist
      const { destinationAddress, paymentReceiptId, winstonCreditAmount } =
        await this.getPaymentReceiptByTopUpQuoteId(
          topUpQuoteId,
          knexTransaction
        );

      const user = await this.getUser(destinationAddress, knexTransaction);

      // Decrement balance of existing user
      const currentBalance = user.winstonCreditBalance;

      let newBalance: Winston;
      try {
        newBalance = currentBalance.minus(winstonCreditAmount);
      } catch (error) {
        // TODO: We don't allow negative winston type. but should we allow negative Winston Credit type in this error scenario?
        throw Error(
          `User with address '${destinationAddress}' does not have enough balance to decrement this chargeback!`
        );
      }

      // Update the users balance.
      await knexTransaction<UserDBResult>(tableNames.user)
        .where({
          user_address: destinationAddress,
        })
        .update({ winston_credit_balance: newBalance.toString() });

      // Remove from payment receipt table,
      const paymentReceiptDbResult =
        await knexTransaction<PaymentReceiptDBResult>(tableNames.paymentReceipt)
          .where({ payment_receipt_id: paymentReceiptId })
          .del()
          .returning("*");

      // Create Chargeback Receipt
      await knexTransaction<ChargebackReceiptDBResult>(
        tableNames.chargebackReceipt
      ).insert({
        ...paymentReceiptDbResult[0],
        chargeback_reason: chargebackReason,
        chargeback_receipt_id: chargebackReceiptId,
      });
    });
  }

  public async getChargebackReceipt(
    chargebackReceiptId: string
  ): Promise<ChargebackReceipt> {
    const chargebackReceiptDbResult =
      await this.knex<ChargebackReceiptDBResult>(
        tableNames.chargebackReceipt
      ).where({
        [columnNames.chargebackReceiptId]: chargebackReceiptId,
      });
    if (chargebackReceiptDbResult.length === 0) {
      throw Error(
        `No chargeback receipt found in database with ID '${chargebackReceiptId}'`
      );
    }

    return chargebackReceiptDbResult.map(chargebackReceiptDBMap)[0];
  }

  public async reserveBalance(
    userAddress: string,
    winstonCreditAmount: Winston
  ): Promise<void> {
    await this.knex.transaction(async (knexTransaction) => {
      const user = await this.getUser(userAddress, knexTransaction);

      const currentWinstonBalance = user.winstonCreditBalance;
      let newBalance: Winston;

      try {
        newBalance = currentWinstonBalance.minus(winstonCreditAmount);
      } catch {
        throw new InsufficientBalance(userAddress);
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
  ): Promise<void> {
    await this.knex.transaction(async (knexTransaction) => {
      const user = await this.getUser(userAddress, knexTransaction);

      const currentWinstonBalance = user.winstonCreditBalance;
      const newBalance = currentWinstonBalance.plus(winstonCreditAmount);

      await knexTransaction<UserDBResult>(tableNames.user)
        .where({
          user_address: userAddress,
        })
        .update({ winston_credit_balance: newBalance.toString() });
    });
  }

  public async checkForExistingPaymentByTopUpQuoteId(
    top_up_quote_id: string
  ): Promise<boolean> {
    return this.knex.transaction(async (knexTransaction) => {
      const [
        paymentReceiptResult,
        chargebackReceiptResult,
        failedTopUpQuoteReceiptResult,
      ] = await Promise.all([
        knexTransaction<PaymentReceiptDBResult>(
          tableNames.paymentReceipt
        ).where({ top_up_quote_id }),
        knexTransaction<ChargebackReceiptDBResult>(
          tableNames.chargebackReceipt
        ).where({
          top_up_quote_id,
        }),
        knexTransaction<FailedTopUpQuoteDBResult>(
          tableNames.failedTopUpQuote
        ).where({ top_up_quote_id }),
      ]);
      return (
        !!paymentReceiptResult.length ||
        !!chargebackReceiptResult.length ||
        !!failedTopUpQuoteReceiptResult.length ||
        false
      );
    });
  }
}
