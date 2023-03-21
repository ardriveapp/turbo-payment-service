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
    await this.createPriceQuoteTable();
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
    await this.pg.schema.dropTable(priceQuote);
    await this.pg.schema.dropTable(paymentReceipt);
    await this.pg.schema.dropTable(chargebackReceipt);

    logger.info("Schema dropped. Initial migration rollback successful!", {
      rollbackDurationMs: Date.now() - rollbackStartTime,
    });
  }

  private async createUserTable(): Promise<void> {
    return this.pg.schema.createTable(user, (t) => {
      t.string(userAddress).primary().notNullable();
      t.string(winstonCreditBalance).notNullable();
      t.timestamp(lastPaymentDate, this.noTimeZone)
        .defaultTo(this.defaultTimestamp())
        .notNullable();
      t.timestamp(lastUploadDate, this.noTimeZone)
        .defaultTo(this.defaultTimestamp())
        .notNullable();
      // TODO: Will jsonb work for this promo info or should we use a string and JSON stringify/parse?
      t.jsonb(promotionalInfo).defaultTo({}).notNullable();
    });
  }

  private async createPriceQuoteTable(): Promise<void> {
    return this.pg.schema.createTable(priceQuote, (t) => {
      t.string(priceQuoteId).primary().notNullable();
      t.string(userAddress).notNullable().index();
      t.string(usdAmount).notNullable();
      t.string(fiatAmount).notNullable();
      t.string(fiatIdentifier).notNullable();
      t.string(winstonCreditAmount).notNullable();
      t.string(paymentProvider).notNullable();
      t.timestamp(quoteExpirationDate, this.noTimeZone).notNullable();
      t.timestamp(quoteCreationDate, this.noTimeZone)
        .notNullable()
        .defaultTo(this.defaultTimestamp());
    });
  }

  private async createPaymentReceiptTable(): Promise<void> {
    return this.pg.schema.createTable(paymentReceipt, (t) => {
      t.string(paymentReceiptId).notNullable().primary();
      t.string(userAddress).notNullable().index();
      t.string(usdAmount).notNullable();
      t.string(fiatAmount).notNullable();
      t.string(fiatIdentifier).notNullable();
      t.string(winstonCreditAmount).notNullable();
      t.string(priceQuoteId).notNullable();
      t.string(paymentProvider).notNullable();
      t.timestamp(paymentReceiptDate, this.noTimeZone)
        .notNullable()
        .defaultTo(this.defaultTimestamp());
    });
  }

  private async createChargebackReceiptTable(): Promise<void> {
    return this.pg.schema.createTable(chargebackReceipt, (t) => {
      t.string(chargebackReceiptId).notNullable().primary();
      t.string(userAddress).notNullable().index();
      t.string(usdAmount).notNullable();
      t.string(winstonCreditAmount).notNullable();
      t.string(paymentReceiptId).notNullable();
      t.string(paymentProvider).notNullable();
      t.string(chargebackReason).notNullable();
      t.timestamp(chargebackReceiptDate, this.noTimeZone)
        .notNullable()
        .defaultTo(this.defaultTimestamp());
    });
  }

  private defaultTimestamp() {
    return this.pg.fn.now();
  }

  private noTimeZone = { useTz: false };
}

const { chargebackReceipt, paymentReceipt, priceQuote, user } = tableNames;

const {
  chargebackReason,
  chargebackReceiptDate,
  chargebackReceiptId,
  fiatAmount,
  fiatIdentifier,
  lastPaymentDate,
  lastUploadDate,
  paymentProvider,
  paymentReceiptDate,
  paymentReceiptId,
  priceQuoteId,
  promotionalInfo,
  quoteCreationDate,
  quoteExpirationDate,
  usdAmount,
  userAddress,
  winstonCreditAmount,
  winstonCreditBalance,
} = columnNames;
