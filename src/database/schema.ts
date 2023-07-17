import { Knex } from "knex";

import logger from "../logger";
import { columnNames, tableNames } from "./dbConstants";
import { AuditLogDBResult } from "./dbTypes";

export class Schema {
  private constructor(private readonly pg: Knex) {}

  public static create(pg: Knex): Promise<void> {
    return new Schema(pg).initializeSchema();
  }

  public static rollback(pg: Knex): Promise<void> {
    return new Schema(pg).rollbackInitialSchema();
  }

  public static migrateToAuditLog(pg: Knex): Promise<void> {
    return new Schema(pg).migrateToAuditLog();
  }

  public static rollbackFromAuditLog(pg: Knex): Promise<void> {
    return new Schema(pg).rollbackFromAuditLog();
  }

  public static async migrateAuditLogToPositiveNegativeCredits(
    pg: Knex
  ): Promise<void> {
    return new Schema(pg).migrateAuditLogToPositiveNegativeCredits();
  }

  public static async rollBackFromMigrateAuditLogToPositiveNegativeCredits(
    pg: Knex
  ): Promise<void> {
    return new Schema(pg).migrateAuditLogToPositiveNegativeCredits();
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

  private async migrateToAuditLog() {
    logger.info("Starting audit log migration...");
    const migrationStartTime = Date.now();

    await this.createAuditLogTable();

    logger.info("Finished audit log migration!", {
      migrationMs: Date.now() - migrationStartTime,
    });
  }

  private async rollbackFromAuditLog() {
    logger.info("Starting audit log rollback...");
    const rollbackStartTime = Date.now();

    await this.pg.schema.dropTable(auditLog);

    logger.info("Finished audit log rollback!", {
      rollbackMs: Date.now() - rollbackStartTime,
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

  private async createAuditLogTable(): Promise<void> {
    return this.pg.schema.createTable(auditLog, (t) => {
      t.increments(auditId).primary();
      t.string(userAddress).notNullable();
      t.timestamp(auditDate).notNullable().defaultTo(this.defaultTimestamp());
      t.string(winstonCreditAmount).notNullable();
      t.string(changeReason).notNullable();
      t.string(changeId).nullable();

      t.index([userAddress, auditDate], "user_audit_range");
    });
  }

  private async migrateAuditLogToPositiveNegativeCredits(): Promise<void> {
    const migrationStartTime = Date.now();
    logger.info("Starting audit log credit amount migration...", {
      startTime: migrationStartTime,
    });
    const negativeCreditChangeReasons = ["chargeback", "upload"];
    const existingAuditRecords = await this.pg<AuditLogDBResult>(
      auditLog
    ).whereIn("change_reason", negativeCreditChangeReasons);
    const negativeChangePromises = existingAuditRecords.reduce(
      (promises: Knex.QueryBuilder[], record: AuditLogDBResult) => {
        if (negativeCreditChangeReasons.includes(record.change_reason)) {
          logger.info(
            "Found audit record that should have negative winston_credit_amount",
            {
              ...record,
            }
          );
          const updatePromise = this.pg(auditLog)
            .update({
              [columnNames.winstonCreditAmount]: `-${record.winston_credit_amount}`,
            })
            .where({ audit_id: record.audit_id });
          promises.push(updatePromise);
        }
        return promises;
      },
      []
    );
    await Promise.all(negativeChangePromises);
    logger.info("Finished audit log credit amount migration!", {
      migrationDurationMs: Date.now() - migrationStartTime,
    });
  }

  private defaultTimestamp() {
    return this.pg.fn.now();
  }
}

const {
  auditLog,
  chargebackReceipt,
  failedTopUpQuote,
  paymentReceipt,
  topUpQuote,
  user,
} = tableNames;

const {
  auditDate,
  auditId,
  paymentAmount,
  changeId,
  changeReason,
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
