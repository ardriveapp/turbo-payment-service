/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { randomUUID } from "crypto";
import { Knex } from "knex";

import logger from "../logger";
import { columnNames, tableNames } from "./dbConstants";
import {
  AuditChangeReason,
  AuditLogDBResult,
  SingleUseCodePaymentCatalogDBInsert,
  SingleUseCodePaymentCatalogDBResult,
} from "./dbTypes";
import {
  addFwdResearchSubsidyUploadCatalogs,
  addToken2049PromoCodeEvent,
  addTurboInfraFee,
  backfillBalanceReservations,
  backfillUploadAdjustments,
} from "./migration";

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
    return new Schema(
      pg
    ).rollBackFromMigrateAuditLogToPositiveNegativeCredits();
  }

  public static migrateToBalanceReservation(pg: Knex): Promise<void> {
    return new Schema(pg).migrateToBalanceReservation();
  }

  public static rollbackFromBalanceReservation(pg: Knex): Promise<void> {
    return new Schema(pg).rollbackFromBalanceReservation();
  }
  private async migrateToBalanceReservation() {
    logger.debug("Starting balance reservation migration...");
    const migrationStartTime = Date.now();

    await this.createBalanceReservationTable();
    await this.createUploadAdjustmentTable();

    await backfillBalanceReservations(this.pg);

    logger.debug("Finished balance reservation migration!", {
      migrationMs: Date.now() - migrationStartTime,
    });
  }

  private async rollbackFromBalanceReservation() {
    logger.debug("Starting balance reservation rollback...");
    const rollbackStartTime = Date.now();

    await this.pg.schema.dropTable(balanceReservation);
    await this.pg.schema.dropTable(uploadAdjustment);

    logger.debug("Finished balance reservation rollback!", {
      rollbackMs: Date.now() - rollbackStartTime,
    });
  }

  public static migrateToPromoCode(pg: Knex): Promise<void> {
    return new Schema(pg).migrateToPromoCode();
  }

  public static rollbackFromPromoCode(pg: Knex): Promise<void> {
    return new Schema(pg).rollbackFromPromoCode();
  }

  private async migrateToPromoCode() {
    logger.debug("Starting promo code migration...");
    const migrationStartTime = Date.now();

    await this.createPaymentAdjustmentTable();

    await this.createUploadAdjustmentCatalogTable();
    await addFwdResearchSubsidyUploadCatalogs(this.pg);

    await this.createPaymentAdjustmentCatalogTable();

    await this.createSingleUseCodePaymentAdjustmentCatalogTable();
    await addToken2049PromoCodeEvent(this.pg);

    // Add quoted payment amount column to top up quote and its extended tables
    await this.pg.schema.alterTable(tableNames.topUpQuote, (t) => {
      t.string(quotedPaymentAmount).notNullable().defaultTo("0");
    });
    await this.pg.schema.alterTable(tableNames.paymentReceipt, (t) => {
      t.string(quotedPaymentAmount).notNullable().defaultTo("0");
    });
    await this.pg.schema.alterTable(tableNames.failedTopUpQuote, (t) => {
      t.string(quotedPaymentAmount).notNullable().defaultTo("0");
    });
    await this.pg.schema.alterTable(tableNames.chargebackReceipt, (t) => {
      t.string(quotedPaymentAmount).notNullable().defaultTo("0");
    });

    // Remove adjustment catalog fields from upload adjustment table
    await this.pg.schema.alterTable(uploadAdjustment, (t) => {
      t.dropColumn(adjustmentDescription);
      t.dropColumn(adjustmentName);
      t.dropColumn(operator);
      t.dropColumn(operatorMagnitude);

      t.string(userAddress)
        .notNullable()
        .defaultTo("PRE-PROMO-CODE-MIGRATION-USER-ADDRESS")
        .index();

      t.string(catalogId)
        .notNullable()
        .defaultTo("PRE-PROMO-CODE-MIGRATION-CATALOG-ID")
        .index();
    });

    logger.debug("Finished promo code migration!", {
      migrationMs: Date.now() - migrationStartTime,
    });
  }

  private async rollbackFromPromoCode() {
    logger.debug("Starting promo code rollback...");
    const rollbackStartTime = Date.now();

    await this.pg.schema.dropTable(paymentAdjustment);
    await this.pg.schema.dropTable(paymentAdjustmentCatalog);
    await this.pg.schema.dropTable(uploadAdjustmentCatalog);
    await this.pg.schema.dropTable(singleUseCodePaymentAdjustmentCatalog);

    await this.pg.schema.alterTable(topUpQuote, (t) => {
      t.dropColumn(quotedPaymentAmount);
    });
    await this.pg.schema.alterTable(paymentReceipt, (t) => {
      t.dropColumn(quotedPaymentAmount);
    });
    await this.pg.schema.alterTable(failedTopUpQuote, (t) => {
      t.dropColumn(quotedPaymentAmount);
    });
    await this.pg.schema.alterTable(chargebackReceipt, (t) => {
      t.dropColumn(quotedPaymentAmount);
    });

    await this.pg.schema.alterTable(uploadAdjustment, (t) => {
      // We intend to DROP ALL columns data here and link to CATALOG IDS
      // Since its stub data, probably NOT backfilling is fine
      t.string(adjustmentDescription).nullable();
      t.string(adjustmentName)
        .notNullable()
        .defaultTo("FWD Research Upload Subsidy");
      t.string(operator).notNullable().defaultTo("multiply");
      t.decimal(operatorMagnitude).notNullable().defaultTo(0.6);

      t.dropColumn(userAddress);
      t.dropColumn(catalogId);
    });

    logger.debug("Finished promo code rollback!", {
      rollbackMs: Date.now() - rollbackStartTime,
    });
  }

  public static migrateForPromoCodeBackfill(pg: Knex): Promise<void> {
    return new Schema(pg).migrateForPromoCodeBackfill();
  }

  public static rollbackFromPromoCodeBackfill(pg: Knex): Promise<void> {
    return new Schema(pg).rollbackFromPromoCodeBackfill();
  }

  private async migrateForPromoCodeBackfill() {
    await backfillUploadAdjustments(this.pg);

    // After backfilling, remove default value from columns
    await this.pg.schema.alterTable(uploadAdjustment, (t) => {
      t.string(userAddress).notNullable().alter();
      t.string(catalogId).notNullable().alter();
    });
    await this.pg.schema.alterTable(tableNames.topUpQuote, (t) => {
      t.string(quotedPaymentAmount).notNullable().alter();
    });
    await this.pg.schema.alterTable(tableNames.paymentReceipt, (t) => {
      t.string(quotedPaymentAmount).notNullable().alter();
    });
    await this.pg.schema.alterTable(tableNames.failedTopUpQuote, (t) => {
      t.string(quotedPaymentAmount).notNullable().alter();
    });

    await this.pg.schema.alterTable(tableNames.chargebackReceipt, (t) => {
      t.string(quotedPaymentAmount).notNullable().alter();
    });
  }

  private async rollbackFromPromoCodeBackfill() {
    logger.debug("Starting promo code backfill rollback...");
    const rollbackStartTime = Date.now();

    // Reapply default values to columns
    await this.pg.schema.alterTable(uploadAdjustment, (t) => {
      t.string(userAddress)
        .notNullable()
        .defaultTo("PRE-PROMO-CODE-MIGRATION-USER-ADDRESS")
        .alter();
      t.string(catalogId)
        .notNullable()
        .defaultTo("PRE-PROMO-CODE-MIGRATION-CATALOG-ID")
        .alter();
    });
    await this.pg.schema.alterTable(tableNames.topUpQuote, (t) => {
      t.string(quotedPaymentAmount).notNullable().defaultTo("0").alter();
    });
    await this.pg.schema.alterTable(tableNames.paymentReceipt, (t) => {
      t.string(quotedPaymentAmount).notNullable().defaultTo("0").alter();
    });
    await this.pg.schema.alterTable(tableNames.failedTopUpQuote, (t) => {
      t.string(quotedPaymentAmount).notNullable().defaultTo("0").alter();
    });

    await this.pg.schema.alterTable(tableNames.chargebackReceipt, (t) => {
      t.string(quotedPaymentAmount).notNullable().defaultTo("0").alter();
    });

    logger.debug("Finished promo code backfill rollback!", {
      rollbackMs: Date.now() - rollbackStartTime,
    });
  }

  public static migrateToTurboInfraFee(pg: Knex): Promise<void> {
    return new Schema(pg).migrateToTurboInfraFee();
  }

  public static rollbackForTurboInfraFee(pg: Knex): Promise<void> {
    return new Schema(pg).rollbackForTurboInfraFee();
  }

  private async migrateToTurboInfraFee() {
    logger.debug("Starting turbo infra fee migration...");
    const migrationStartTime = Date.now();

    await addTurboInfraFee(this.pg);

    logger.debug("Finished turbo infra fee migration!", {
      migrationMs: Date.now() - migrationStartTime,
    });
  }

  public static migrateToTargetedPromoCodes(pg: Knex): Promise<void> {
    return new Schema(pg).migrateToTargetedPromoCodes();
  }

  public static rollbackFromTargetedPromoCodes(pg: Knex): Promise<void> {
    return new Schema(pg).rollbackFromTargetedPromoCodes();
  }

  private async migrateToTargetedPromoCodes() {
    logger.debug("Starting targeted promo codes migration...");
    const migrationStartTime = Date.now();

    await this.pg.schema.alterTable(
      singleUseCodePaymentAdjustmentCatalog,
      (t) => {
        t.string("target_user_group").defaultTo("all");
      }
    );

    // Add YOUTUBE promo code with no expiration date as of yet
    const youtubeCodeInsert: SingleUseCodePaymentCatalogDBInsert = {
      adjustment_name: "Sept 2023 YouTube Promo Code",
      adjustment_exclusivity: "exclusive",
      catalog_id: randomUUID(),
      code_value: "YOUTUBE",
      operator: "multiply",
      operator_magnitude: "0.8",
      adjustment_description:
        "20% off top-up purchases, available only to users who have never topped up before.",
      target_user_group: "new",
    };
    await this.pg(
      singleUseCodePaymentAdjustmentCatalog
    ).insert<SingleUseCodePaymentCatalogDBResult>(youtubeCodeInsert);

    // Expire TOKEN2049 at end of Sep 29
    await this.pg(singleUseCodePaymentAdjustmentCatalog)
      .update<SingleUseCodePaymentCatalogDBResult>({
        adjustment_end_date: "2023-09-30T00:00:00.000Z",
      })
      .where({ code_value: "TOKEN2049" });

    logger.debug("Finished targeted promo codes migration!", {
      migrationMs: Date.now() - migrationStartTime,
    });
  }

  private async rollbackForTurboInfraFee() {
    logger.debug("Starting turbo infra fee rollback...");
    const rollbackStartTime = Date.now();

    await this.pg(tableNames.paymentAdjustmentCatalog)
      .where({
        [columnNames.adjustmentName]: "Turbo Infrastructure Fee",
      })
      .delete();

    logger.debug("Finished turbo infra fee rollback!", {
      rollbackMs: Date.now() - rollbackStartTime,
    });
  }
  private async rollbackFromTargetedPromoCodes() {
    logger.debug("Starting targeted promo codes rollback...");
    const rollbackStartTime = Date.now();

    await this.pg.schema.alterTable(
      singleUseCodePaymentAdjustmentCatalog,
      (t) => {
        t.dropColumn("target_user_group");
      }
    );

    // Remove YOUTUBE promo code øn rollback
    await this.pg(singleUseCodePaymentAdjustmentCatalog)
      .where({ adjustment_name: "Sept 2023 YouTube Promo Code" })
      .delete();

    // No need to un-expire TOKEN2049 on rollback

    logger.debug("Finished targeted promo codes rollback!", {
      rollbackMs: Date.now() - rollbackStartTime,
    });
  }

  private async createBalanceReservationTable(): Promise<void> {
    return this.pg.schema.createTable(balanceReservation, (t) => {
      t.string(reservationId).primary();
      t.string(dataItemId).notNullable().index();
      t.string(userAddress).notNullable().index();
      t.string(reservedWincAmount).notNullable();
      t.string(networkWincAmount).notNullable();
      t.timestamp(reservedDate)
        .index()
        .notNullable()
        .defaultTo(this.defaultTimestamp());
    });
  }

  private async createUploadAdjustmentTable(): Promise<void> {
    return this.pg.schema.createTable(uploadAdjustment, (t) => {
      t.increments(adjustmentId).primary();
      t.string(reservationId).notNullable().index();
      t.string(adjustedWincAmount).notNullable();
      t.integer(adjustmentIndex).notNullable();
      t.timestamp(adjustmentDate)
        .index()
        .notNullable()
        .defaultTo(this.defaultTimestamp());

      // These were columns removed in PE-3896
      t.string(operator).notNullable();
      t.decimal(operatorMagnitude).notNullable();
      t.string(adjustmentName).notNullable();
      t.string(adjustmentDescription).notNullable();
    });
  }

  private async createPaymentAdjustmentTable(): Promise<void> {
    return this.pg.schema.createTable(paymentAdjustment, (t) => {
      t.increments(adjustmentId).primary();
      t.string(topUpQuoteId).notNullable().index();
      t.string(userAddress).notNullable().index();
      t.string(adjustedPaymentAmount).notNullable();
      t.string(adjustedCurrencyType).notNullable();

      t.string(catalogId).notNullable().index();
      t.integer(adjustmentIndex).notNullable();
      t.timestamp(adjustmentDate)
        .index()
        .notNullable()
        .defaultTo(this.defaultTimestamp());
    });
  }

  private catalogTableCreator(t: Knex.CreateTableBuilder): void {
    t.string(catalogId).primary();
    t.string(adjustmentName).notNullable();
    t.string(adjustmentDescription).notNullable().defaultTo("");

    t.integer(adjustmentPriority).notNullable().defaultTo(500);
    t.string(operator).notNullable();
    t.string(operatorMagnitude).notNullable();

    t.timestamp(adjustmentStartDate)
      .index()
      .notNullable()
      .defaultTo(this.defaultTimestamp());
    t.timestamp(adjustmentEndDate).index().nullable();
  }

  private async createUploadAdjustmentCatalogTable(): Promise<void> {
    return this.pg.schema.createTable(uploadAdjustmentCatalog, (t) => {
      this.catalogTableCreator(t);
    });
  }

  private async createPaymentAdjustmentCatalogTable(): Promise<void> {
    return this.pg.schema.createTable(paymentAdjustmentCatalog, (t) => {
      this.catalogTableCreator(t);
      t.string(adjustmentExclusivity).notNullable().defaultTo("inclusive");
    });
  }

  private async createSingleUseCodePaymentAdjustmentCatalogTable(): Promise<void> {
    return this.pg.schema.createTable(
      singleUseCodePaymentAdjustmentCatalog,
      (t) => {
        this.catalogTableCreator(t);
        t.string(adjustmentExclusivity).notNullable().defaultTo("inclusive");
        t.string(adjustmentCodeValue).notNullable();
      }
    );
  }

  private async initializeSchema(): Promise<void> {
    logger.debug("Starting initial migration...");
    const migrationStartTime = Date.now();

    await this.createUserTable();
    await this.createTopUpQuoteTable();
    await this.createFailedTopUpQuoteTable();
    await this.createPaymentReceiptTable();
    await this.createChargebackReceiptTable();

    logger.debug("Finished initial migration!", {
      migrationDurationMs: Date.now() - migrationStartTime,
    });
  }

  private async rollbackInitialSchema(): Promise<void> {
    logger.debug("Rolling back schema from initial migration...");
    const rollbackStartTime = Date.now();

    await this.pg.schema.dropTable(user);
    await this.pg.schema.dropTable(topUpQuote);
    await this.pg.schema.dropTable(failedTopUpQuote);
    await this.pg.schema.dropTable(paymentReceipt);
    await this.pg.schema.dropTable(chargebackReceipt);

    logger.debug("Schema dropped. Initial migration rollback successful!", {
      rollbackDurationMs: Date.now() - rollbackStartTime,
    });
  }

  private async migrateToAuditLog() {
    logger.debug("Starting audit log migration...");
    const migrationStartTime = Date.now();

    await this.createAuditLogTable();

    logger.debug("Finished audit log migration!", {
      migrationMs: Date.now() - migrationStartTime,
    });
  }

  private async rollbackFromAuditLog() {
    logger.debug("Starting audit log rollback...");
    const rollbackStartTime = Date.now();

    await this.pg.schema.dropTable(auditLog);

    logger.debug("Finished audit log rollback!", {
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
    logger.debug("Starting audit log credit amount migration...", {
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
          logger.debug(
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
    logger.debug("Finished audit log credit amount migration!", {
      migrationDurationMs: Date.now() - migrationStartTime,
      numRecords: negativeChangePromises.length,
    });
  }

  private async rollBackFromMigrateAuditLogToPositiveNegativeCredits(): Promise<void> {
    const migrationStartTime = Date.now();
    logger.debug(
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
    logger.debug("Finished audit log credit amount rollback!", {
      migrationDurationMs: Date.now() - migrationStartTime,
      numRecords: negativeChangePromises.length,
    });
  }

  private defaultTimestamp() {
    return this.pg.fn.now();
  }
}

const {
  uploadAdjustment,
  auditLog,
  balanceReservation,
  chargebackReceipt,
  failedTopUpQuote,
  paymentReceipt,
  topUpQuote,
  user,
  paymentAdjustment,
  paymentAdjustmentCatalog,
  singleUseCodePaymentAdjustmentCatalog,
  uploadAdjustmentCatalog,
} = tableNames;

const {
  adjustedCurrencyType,
  adjustedPaymentAmount,
  adjustedWincAmount,
  adjustmentCodeValue,
  adjustmentDate,
  adjustmentDescription,
  adjustmentEndDate,
  adjustmentExclusivity,
  adjustmentName,
  adjustmentId,
  adjustmentIndex,
  adjustmentStartDate,
  adjustmentPriority,
  auditDate,
  auditId,
  paymentAmount,
  catalogId,
  changeId,
  changeReason,
  chargebackReason,
  chargebackReceiptDate,
  chargebackReceiptId,
  currencyType,
  dataItemId,
  destinationAddress,
  destinationAddressType,
  failedReason,
  networkWincAmount,
  operator,
  operatorMagnitude,
  paymentProvider,
  paymentReceiptDate,
  paymentReceiptId,
  promotionalInfo,
  quoteCreationDate,
  quotedPaymentAmount,
  quoteExpirationDate,
  quoteFailedDate,
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
