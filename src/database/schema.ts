import { Knex } from "knex";

import logger from "../logger";
import { columnNames, tableNames } from "./dbConstants";

export class Schema {
  private constructor(private readonly pg: Knex) {}

  public static create(pg: Knex): Promise<void> {
    return new Schema(pg).initializeSchema();
  }

  public static rollback(pg: Knex): Promise<void> {
    return new Schema(pg).rollbackInitialSchema();
  }

  private async initializeSchema(): Promise<void> {
    logger.info("Starting initial migration...");
    const migrationStartTime = Date.now();

    await this.createUserTable();
    await this.createTopUpQuoteTable();
    await this.createFulfilledTopUpQuoteTable();
    await this.createFailedTopUpQuoteTable();
    await this.createPaymentReceiptTable();
    await this.createRescindedPaymentReceiptTable();
    await this.createChargebackReceiptTable();

    logger.info("Finished initial migration!", {
      migrationDurationMs: Date.now() - migrationStartTime,
    });
  }

  private async rollbackInitialSchema(): Promise<void> {
    logger.info("Rolling back schema from initial migration...");
    const rollbackStartTime = Date.now();

    await this.pg.schema.dropTable(user);
    await this.pg.schema.dropTable(topUpQuote);
    await this.pg.schema.dropTable(fulfilledTopUpQuote);
    await this.pg.schema.dropTable(failedTopUpQuote);
    await this.pg.schema.dropTable(paymentReceipt);
    await this.pg.schema.dropTable(rescindedPaymentReceipt);
    await this.pg.schema.dropTable(chargebackReceipt);

    logger.info("Schema dropped. Initial migration rollback successful!", {
      rollbackDurationMs: Date.now() - rollbackStartTime,
    });
  }

  private async createUserTable(): Promise<void> {
    return this.pg.schema.createTable(user, (t) => {
      t.string(userAddress).primary().notNullable();
      t.string(userAddressType).notNullable();
      t.string(winstonCreditBalance).notNullable();
      t.jsonb(promotionalInfo).defaultTo({}).notNullable();
    });
  }

  private async createTopUpQuoteTable(): Promise<void> {
    return this.pg.schema.createTable(topUpQuote, (t) => {
      t.string(topUpQuoteId).primary().notNullable();
      t.string(destinationAddress).notNullable().index();
      t.string(destinationAddressType).notNullable();
      t.string(amount).notNullable();
      t.string(currencyType).notNullable();
      t.string(winstonCreditAmount).notNullable();
      t.string(paymentProvider).notNullable();
      t.timestamp(quoteExpirationDate).notNullable();
      t.timestamp(quoteCreationDate)
        .notNullable()
        .defaultTo(this.defaultTimestamp());
    });
  }

  private async createFulfilledTopUpQuoteTable(): Promise<void> {
    return this.pg.schema.createTableLike(
      fulfilledTopUpQuote,
      topUpQuote,
      (t) => {
        t.timestamp(quoteFulfilledDate)
          .notNullable()
          .defaultTo(this.defaultTimestamp());
      }
    );
  }

  private async createFailedTopUpQuoteTable(): Promise<void> {
    return this.pg.schema.createTableLike(failedTopUpQuote, topUpQuote, (t) => {
      t.timestamp(quoteFailedDate)
        .notNullable()
        .defaultTo(this.defaultTimestamp());
    });
  }

  private async createPaymentReceiptTable(): Promise<void> {
    return this.pg.schema.createTable(paymentReceipt, (t) => {
      t.string(paymentReceiptId).notNullable().primary();
      t.string(destinationAddress).notNullable().index();
      t.string(destinationAddressType).notNullable();
      t.string(amount).notNullable();
      t.string(currencyType).notNullable();
      t.string(winstonCreditAmount).notNullable();
      // TODO: Index this if we access it in the app
      t.string(topUpQuoteId).notNullable();
      t.string(paymentProvider).notNullable();
      t.timestamp(paymentReceiptDate)
        .notNullable()
        .defaultTo(this.defaultTimestamp());
    });
  }

  private async createRescindedPaymentReceiptTable(): Promise<void> {
    return this.pg.schema.createTableLike(
      rescindedPaymentReceipt,
      paymentReceipt,
      (t) => {
        t.timestamp(paymentReceiptRescindedDate)
          .notNullable()
          .defaultTo(this.defaultTimestamp());
      }
    );
  }

  private async createChargebackReceiptTable(): Promise<void> {
    return this.pg.schema.createTable(chargebackReceipt, (t) => {
      t.string(chargebackReceiptId).notNullable().primary();
      t.string(destinationAddress).notNullable().index();
      t.string(destinationAddressType).notNullable();
      t.string(amount).notNullable();
      t.string(currencyType).notNullable();
      t.string(winstonCreditAmount).notNullable();
      t.string(paymentReceiptId).notNullable();
      t.string(paymentProvider).notNullable();
      t.string(chargebackReason).notNullable();
      t.timestamp(chargebackReceiptDate)
        .notNullable()
        .defaultTo(this.defaultTimestamp());
    });
  }

  private defaultTimestamp() {
    return this.pg.fn.now();
  }
}

const {
  chargebackReceipt,
  failedTopUpQuote,
  fulfilledTopUpQuote,
  rescindedPaymentReceipt,
  paymentReceipt,
  topUpQuote,
  user,
} = tableNames;

const {
  amount,
  chargebackReason,
  chargebackReceiptDate,
  chargebackReceiptId,
  currencyType,
  destinationAddress,
  destinationAddressType,
  paymentProvider,
  paymentReceiptDate,
  paymentReceiptId,
  paymentReceiptRescindedDate,
  promotionalInfo,
  quoteCreationDate,
  quoteExpirationDate,
  quoteFailedDate,
  quoteFulfilledDate,
  topUpQuoteId,
  userAddress,
  userAddressType,
  winstonCreditAmount,
  winstonCreditBalance,
} = columnNames;
