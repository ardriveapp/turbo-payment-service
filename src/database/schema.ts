import { Knex } from "knex";

import logger from "../logger";
import { columnNames, tableNames } from "./dbConstants";
import {
  AuditChangeReason,
  AuditLogDBResult,
  PriceAdjustmentDBResult,
} from "./dbTypes";

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

  public static migrateToBalanceReservation(pg: Knex): Promise<void> {
    return new Schema(pg).migrateToBalanceReservation();
  }

  public static rollbackFromBalanceReservation(pg: Knex): Promise<void> {
    return new Schema(pg).rollbackFromBalanceReservation();
  }

  public static async migrateAuditLogToPositiveNegativeCredits(
    pg: Knex
  ): Promise<void> {
    return new Schema(pg).migrateAuditLogToPositiveNegativeCredits();
  }

  public static async rollBackFromMigrateAuditLogToPositiveNegativeCredits(
    pg: Knex
  ): Promise<void> {
    return new Schema(
      pg
    ).rollBackFromMigrateAuditLogToPositiveNegativeCredits();
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

  private async migrateToBalanceReservation() {
    logger.info("Starting balance reservation migration...");
    const migrationStartTime = Date.now();

    await this.createBalanceReservationTable();
    await this.createFinalizedReservationTable();
    await this.createRefundedReservationTable();
    await this.createPriceAdjustmentTable();

    // FWD Research Promotions
    await this.pg<PriceAdjustmentDBResult>(priceAdjustment).insert({
      adjustment_start_date: new Date("2023-07-15").toISOString(),
      adjustment_expiration_date: new Date("2023-08-15").toISOString(),
      adjustment_name: "FWD Research July '23 Upload Subsidy",
      adjustment_target: "upload",
      adjustment_operator: "subsidy",
      adjustment_value: 0.6,
    });

    await this.pg<PriceAdjustmentDBResult>(priceAdjustment).insert({
      adjustment_start_date: new Date("2023-08-15").toISOString(),
      adjustment_expiration_date: new Date("2023-09-15").toISOString(),
      adjustment_name: "FWD Research August '23 Upload Subsidy",
      adjustment_target: "upload",
      adjustment_operator: "subsidy",
      adjustment_value: 0.525,
    });

    await this.pg<PriceAdjustmentDBResult>(priceAdjustment).insert({
      adjustment_start_date: new Date("2023-09-15").toISOString(),
      adjustment_expiration_date: new Date("2023-10-15").toISOString(),
      adjustment_name: "FWD Research September '23 Upload Subsidy",
      adjustment_target: "upload",
      adjustment_operator: "subsidy",
      adjustment_value: 0.45,
    });

    await this.pg<PriceAdjustmentDBResult>(priceAdjustment).insert({
      adjustment_start_date: new Date("2023-10-15").toISOString(),
      adjustment_expiration_date: new Date("2023-11-15").toISOString(),
      adjustment_name: "FWD Research October '23 Upload Subsidy",
      adjustment_target: "upload",
      adjustment_operator: "subsidy",
      adjustment_value: 0.375,
    });

    await this.pg<PriceAdjustmentDBResult>(priceAdjustment).insert({
      adjustment_start_date: new Date("2023-11-15").toISOString(),
      adjustment_expiration_date: new Date("2023-12-15").toISOString(),
      adjustment_name: "FWD Research November '23 Upload Subsidy",
      adjustment_target: "upload",
      adjustment_operator: "subsidy",
      adjustment_value: 0.3,
    });

    await this.pg<PriceAdjustmentDBResult>(priceAdjustment).insert({
      adjustment_start_date: new Date("2023-12-15").toISOString(),
      adjustment_expiration_date: new Date("2024-01-15").toISOString(),
      adjustment_name: "FWD Research December '23 Upload Subsidy",
      adjustment_target: "upload",
      adjustment_operator: "subsidy",
      adjustment_value: 0.225,
    });

    await this.pg<PriceAdjustmentDBResult>(priceAdjustment).insert({
      adjustment_start_date: new Date("2024-01-15").toISOString(),
      adjustment_expiration_date: new Date("2024-02-15").toISOString(),
      adjustment_name: "FWD Research January '24 Upload Subsidy",
      adjustment_target: "upload",
      adjustment_operator: "subsidy",
      adjustment_value: 0.15,
    });

    await this.pg<PriceAdjustmentDBResult>(priceAdjustment).insert({
      adjustment_start_date: new Date("2024-02-15").toISOString(),
      adjustment_expiration_date: new Date("2024-03-15").toISOString(),
      adjustment_name: "FWD Research February '24 Upload Subsidy",
      adjustment_target: "upload",
      adjustment_operator: "subsidy",
      adjustment_value: 0.075,
    });

    logger.info("Finished balance reservation migration!", {
      migrationMs: Date.now() - migrationStartTime,
    });
  }

  private async rollbackFromBalanceReservation() {
    logger.info("Starting balance reservation rollback...");
    const rollbackStartTime = Date.now();

    await this.pg.schema.dropTable(balanceReservation);
    await this.pg.schema.dropTable(finalizedReservation);
    await this.pg.schema.dropTable(refundedReservation);
    await this.pg.schema.dropTable(priceAdjustment);

    logger.info("Finished balance reservation rollback!", {
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
    const negativeCreditChangeReasons: AuditChangeReason[] = [
      "chargeback",
      "upload",
    ];
    const existingAuditRecords = await this.pg<AuditLogDBResult>(auditLog)
      .whereIn("change_reason", negativeCreditChangeReasons)
      .andWhere("winston_credit_amount", "not like", "-%"); // filter out existing rows that are already negative
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
      numRecords: negativeChangePromises.length,
    });
  }

  private async rollBackFromMigrateAuditLogToPositiveNegativeCredits(): Promise<void> {
    const migrationStartTime = Date.now();
    logger.info(
      "Rolling back schema from audit log positive/negative credit balance migration...",
      {
        startTime: migrationStartTime,
      }
    );
    const negativeCreditChangeReasons: AuditChangeReason[] = [
      "chargeback",
      "upload",
    ];
    const existingAuditRecords = await this.pg<AuditLogDBResult>(auditLog)
      .whereIn("change_reason", negativeCreditChangeReasons)
      .andWhere("winston_credit_amount", "like", "-%"); // only modify rows that are negative
    const negativeChangePromises = existingAuditRecords.reduce(
      (promises: Knex.QueryBuilder[], record: AuditLogDBResult) => {
        if (negativeCreditChangeReasons.includes(record.change_reason)) {
          const updatePromise = this.pg(auditLog)
            .update({
              [columnNames.winstonCreditAmount]:
                record.winston_credit_amount.replace("-", ""),
            })
            .where({ audit_id: record.audit_id });
          promises.push(updatePromise);
        }
        return promises;
      },
      []
    );
    await Promise.all(negativeChangePromises);
    logger.info("Finished audit log credit amount rollback!", {
      migrationDurationMs: Date.now() - migrationStartTime,
      numRecords: negativeChangePromises.length,
    });
  }

  private async createBalanceReservationTable(): Promise<void> {
    return this.pg.schema.createTable(balanceReservation, (t) => {
      t.string(reservationId).primary();
      t.string(userAddress).notNullable().index();
      t.timestamp(reservedDate)
        .notNullable()
        .defaultTo(this.defaultTimestamp());
      t.string(reservedWincAmount).notNullable();
      t.jsonb(adjustments).defaultTo([]);
      t.index(["adjustments"], "adjustment_idx", "gin");
    });
  }

  private async createFinalizedReservationTable(): Promise<void> {
    return this.pg.schema.createTable(finalizedReservation, (t) => {
      t.string(reservationId).primary();
      t.string(userAddress).notNullable().index();
      t.timestamp(reservedDate).notNullable();
      t.string(reservedWincAmount).notNullable();
      t.jsonb(adjustments).notNullable();
      t.index(["adjustments"], "finalized_adjustment_idx", "gin");

      t.timestamp(finalizedDate)
        .notNullable()
        .defaultTo(this.defaultTimestamp());
      t.string(amortizedWincAmount).notNullable();
    });
  }

  private async createRefundedReservationTable(): Promise<void> {
    return this.pg.schema.createTable(refundedReservation, (t) => {
      t.string(reservationId).primary();
      t.string(userAddress).notNullable().index();
      t.timestamp(reservedDate).notNullable();
      t.string(reservedWincAmount).notNullable();
      t.jsonb(adjustments).notNullable();
      t.index(["adjustments"], "refunded_adjustment_idx", "gin");

      t.timestamp(refundedDate)
        .notNullable()
        .defaultTo(this.defaultTimestamp());
      t.string(refundedReason).notNullable();
    });
  }

  private async createPriceAdjustmentTable(): Promise<void> {
    return this.pg.schema.createTable(priceAdjustment, (t) => {
      t.increments(adjustmentId).primary();
      t.string(adjustmentName).notNullable();
      t.string(adjustmentTarget).notNullable();
      t.string(adjustmentOperator).notNullable();
      t.integer(adjustmentPriority).notNullable().defaultTo(1);
      t.decimal(adjustmentValue).notNullable();
      t.timestamp(adjustmentStartDate)
        .notNullable()
        .defaultTo(this.defaultTimestamp());
      t.timestamp(adjustmentExpirationDate).notNullable();
    });
  }

  private defaultTimestamp() {
    return this.pg.fn.now();
  }
}

const {
  auditLog,
  balanceReservation,
  chargebackReceipt,
  failedTopUpQuote,
  finalizedReservation,
  paymentReceipt,
  priceAdjustment,
  refundedReservation,
  topUpQuote,
  user,
} = tableNames;

const {
  adjustmentExpirationDate,
  adjustmentId,
  adjustmentName,
  adjustmentOperator,
  adjustmentPriority,
  adjustmentStartDate,
  adjustmentTarget,
  adjustmentValue,
  adjustments,
  amortizedWincAmount,
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
  finalizedDate,
  paymentProvider,
  paymentReceiptDate,
  paymentReceiptId,
  promotionalInfo,
  quoteCreationDate,
  quoteExpirationDate,
  quoteFailedDate,
  refundedDate,
  refundedReason,
  reservationId,
  reservedDate,
  reservedWincAmount,
  topUpQuoteId,
  userAddress,
  userAddressType,
  userCreationDate,
  winstonCreditAmount,
  winstonCreditBalance,
} = columnNames;
