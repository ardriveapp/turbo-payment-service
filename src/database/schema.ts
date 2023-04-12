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
    await this.createFailedTopUpQuoteTable();
    await this.createPaymentReceiptTable();
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
    await this.pg.schema.dropTable(failedTopUpQuote);
    await this.pg.schema.dropTable(paymentReceipt);
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
      t.timestamp(userCreationDate)
        .notNullable()
        .defaultTo(this.defaultTimestamp());
    });
  }

  private async createTopUpQuoteTable(): Promise<void> {
    return this.pg.schema.createTable(topUpQuote, (t) => {
      t.string(topUpQuoteId).primary().notNullable();
      t.string(destinationAddress).notNullable().index();
      t.string(destinationAddressType).notNullable();
      t.string(paymentAmount).notNullable();
      t.string(currencyType).notNullable();
      t.string(winstonCreditAmount).notNullable();
      t.string(paymentProvider).notNullable();
      t.timestamp(quoteExpirationDate).notNullable();
      t.timestamp(quoteCreationDate)
        .notNullable()
        .defaultTo(this.defaultTimestamp());
    });
  }

  private async createFailedTopUpQuoteTable(): Promise<void> {
    return this.pg.schema.createTable(failedTopUpQuote, (t) => {
      t.string(topUpQuoteId).primary().notNullable();
      t.string(destinationAddress).notNullable().index();
      t.string(destinationAddressType).notNullable();
      t.string(paymentAmount).notNullable();
      t.string(currencyType).notNullable();
      t.string(winstonCreditAmount).notNullable();
      t.string(paymentProvider).notNullable();
      t.timestamp(quoteExpirationDate).notNullable();
      t.timestamp(quoteCreationDate).notNullable();

      t.string(failedReason).index().notNullable();
      t.timestamp(quoteFailedDate)
        .notNullable()
        .defaultTo(this.defaultTimestamp());
    });
  }

  private async createPaymentReceiptTable(): Promise<void> {
    return this.pg.schema.createTable(paymentReceipt, (t) => {
      t.string(topUpQuoteId).index().notNullable();
      t.string(destinationAddress).notNullable().index();
      t.string(destinationAddressType).notNullable();
      t.string(paymentAmount).notNullable();
      t.string(currencyType).notNullable();
      t.string(winstonCreditAmount).notNullable();
      t.string(paymentProvider).notNullable();
      t.timestamp(quoteExpirationDate).notNullable();
      t.timestamp(quoteCreationDate).notNullable();

      t.string(paymentReceiptId).notNullable().primary();
      t.timestamp(paymentReceiptDate)
        .notNullable()
        .defaultTo(this.defaultTimestamp());
    });
  }

  private async createChargebackReceiptTable(): Promise<void> {
    return this.pg.schema.createTable(chargebackReceipt, (t) => {
      t.string(topUpQuoteId).index().notNullable();
      t.string(destinationAddress).notNullable().index();
      t.string(destinationAddressType).notNullable();
      t.string(paymentAmount).notNullable();
      t.string(currencyType).notNullable();
      t.string(winstonCreditAmount).notNullable();
      t.string(paymentProvider).notNullable();
      t.timestamp(quoteExpirationDate).notNullable();
      t.timestamp(quoteCreationDate).notNullable();

      t.string(paymentReceiptId).notNullable();
      t.timestamp(paymentReceiptDate).notNullable();

      t.string(chargebackReceiptId).notNullable().primary();
      t.string(chargebackReason).index().notNullable();
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
  paymentReceipt,
  topUpQuote,
  user,
} = tableNames;

const {
  paymentAmount,
  chargebackReason,
  chargebackReceiptDate,
  chargebackReceiptId,
  currencyType,
  destinationAddress,
  destinationAddressType,
  failedReason,
  paymentProvider,
  paymentReceiptDate,
  paymentReceiptId,
  promotionalInfo,
  quoteCreationDate,
  quoteExpirationDate,
  quoteFailedDate,
  topUpQuoteId,
  userAddress,
  userAddressType,
  userCreationDate,
  winstonCreditAmount,
  winstonCreditBalance,
} = columnNames;
