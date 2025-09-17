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
import { Knex } from "knex";
import { randomUUID } from "node:crypto";

import globalLogger from "../logger";
import { columnNames, tableNames } from "./dbConstants";
import {
  PaymentAdjustmentCatalogDBInsert,
  SingleUseCodePaymentCatalogDBInsert,
} from "./dbTypes";
import { backfillTurboInfraFee, rollbackInfraFeeBackfill } from "./migration";

export abstract class Migrator {
  protected async operate({
    name,
    operation,
  }: {
    name: string;
    operation: () => Promise<void>;
  }) {
    globalLogger.debug(`Starting ${name}...`);
    const startTime = Date.now();

    await operation();

    globalLogger.debug(`Finished ${name}!`, {
      durationMs: Date.now() - startTime,
    });
  }

  abstract migrate(): Promise<void>;
  abstract rollback(): Promise<void>;
}

export class BackfillInfraFeeMigrator extends Migrator {
  constructor(private readonly knex: Knex) {
    super();
  }

  public migrate() {
    return this.operate({
      name: "migrate to backfill infra fee",
      operation: () => backfillTurboInfraFee(this.knex),
    });
  }

  public rollback() {
    return this.operate({
      name: "rollback from infra fee backfill",
      operation: () => rollbackInfraFeeBackfill(this.knex),
    });
  }
}

export class PilotReferralMigrator extends Migrator {
  constructor(private readonly knex: Knex) {
    super();
  }

  public migrate() {
    return this.operate({
      name: "migrate to pilot referral",
      operation: () =>
        this.knex.schema.alterTable(
          tableNames.singleUseCodePaymentAdjustmentCatalog,
          (table) => {
            table.integer(columnNames.maxUses).notNullable().defaultTo(0);
            table
              .integer(columnNames.minimumPaymentAmount)
              .notNullable()
              .defaultTo(0);
          }
        ),
    });
  }

  public rollback() {
    return this.operate({
      name: "rollback from pilot referral",
      operation: () =>
        this.knex.schema.alterTable(
          tableNames.singleUseCodePaymentAdjustmentCatalog,
          (table) => {
            table.dropColumn(columnNames.maxUses);
            table.dropColumn(columnNames.minimumPaymentAmount);
          }
        ),
    });
  }
}

export class MaxDiscountMigrator extends Migrator {
  constructor(private readonly knex: Knex) {
    super();
  }

  public migrate() {
    return this.operate({
      name: "migrate to max discount",
      operation: async () => {
        await this.knex.schema.alterTable(
          tableNames.singleUseCodePaymentAdjustmentCatalog,
          (table) => {
            table
              .integer(columnNames.maximumDiscountAmount)
              .notNullable()
              .defaultTo(0);
          }
        );
        const pilot50DbInsert: SingleUseCodePaymentCatalogDBInsert = {
          adjustment_name: "Pilot-50 2023 Promo Code",
          adjustment_description: "50% off for new users",
          operator: "multiply",
          operator_magnitude: "0.5",
          target_user_group: "new",
          catalog_id: randomUUID(),
          code_value: "PILOT50",
          adjustment_exclusivity: "exclusive",
          maximum_discount_amount: 10_00,
        };
        await this.knex(
          tableNames.singleUseCodePaymentAdjustmentCatalog
        ).insert(pilot50DbInsert);
      },
    });
  }

  public rollback() {
    return this.operate({
      name: "rollback from max discount",
      operation: async () => {
        await this.knex.schema.alterTable(
          tableNames.singleUseCodePaymentAdjustmentCatalog,
          (table) => {
            table.dropColumn(columnNames.maximumDiscountAmount);
          }
        );
        await this.knex(tableNames.singleUseCodePaymentAdjustmentCatalog)
          .where({ code_value: "PILOT50" })
          .del();
      },
    });
  }
}

export class GiftByEmailMigrator extends Migrator {
  constructor(private readonly knex: Knex) {
    super();
  }

  private topUpQuoteTableNames = [
    tableNames.topUpQuote,
    tableNames.paymentReceipt,
    tableNames.failedTopUpQuote,
    tableNames.chargebackReceipt,
  ];

  public migrate() {
    return this.operate({
      name: "migrate to gift by email",
      operation: async () => {
        await Promise.all(
          this.topUpQuoteTableNames.map((table) =>
            this.knex.schema.alterTable(table, (table) => {
              table.string(columnNames.giftMessage).nullable();
            })
          )
        );

        await this.knex.schema.createTable(
          tableNames.unredeemedGift,
          (table) => {
            table.string(columnNames.paymentReceiptId).primary();
            table.string(columnNames.recipientEmail).notNullable();
            table
              .timestamp(columnNames.creationDate)
              .notNullable()
              .defaultTo(this.knex.fn.now());
            table
              .timestamp(columnNames.expirationDate)
              .notNullable()
              .defaultTo(this.knex.raw("now() + interval '1 year'"));
            table.string(columnNames.giftedWincAmount).notNullable();
            table.string(columnNames.giftMessage).nullable();
            table.string(columnNames.senderEmail).nullable();
          }
        );

        await this.knex.schema.createTableLike(
          tableNames.redeemedGift,
          tableNames.unredeemedGift,
          (table) => {
            table
              .timestamp(columnNames.redemptionDate)
              .notNullable()
              .defaultTo(this.knex.fn.now());
            table.string(columnNames.destinationAddress).notNullable();
          }
        );
      },
    });
  }

  public rollback() {
    return this.operate({
      name: "rollback from gift by email",
      operation: async () => {
        await Promise.all(
          this.topUpQuoteTableNames.map((table) =>
            this.knex.schema.alterTable(table, (table) => {
              table.dropColumn(columnNames.giftMessage);
            })
          )
        );

        await this.knex.schema.dropTable(tableNames.unredeemedGift);
        await this.knex.schema.dropTable(tableNames.redeemedGift);
      },
    });
  }
}

export class LimitedSubsidyEventMigrator extends Migrator {
  constructor(private readonly knex: Knex) {
    super();
  }

  public migrate() {
    return this.operate({
      name: "migrate to limited subsidy event",
      operation: async () => {
        await this.knex.schema.alterTable(
          tableNames.uploadAdjustmentCatalog,
          (table) => {
            table
              .string(columnNames.byteCountThreshold)
              .notNullable()
              .defaultTo("0");
            table
              .string(columnNames.wincLimitation)
              .notNullable()
              .defaultTo("0");
            table
              .string(columnNames.limitationInterval)
              .notNullable()
              .defaultTo("24"); // 24 hours
            table
              .string(columnNames.limitationIntervalUnit)
              .notNullable()
              .defaultTo("hour"); // 24 hours
          }
        );
      },
    });
  }

  public rollback() {
    return this.operate({
      name: "rollback from limited subsidy event",
      operation: async () => {
        await this.knex.schema.alterTable(
          tableNames.singleUseCodePaymentAdjustmentCatalog,
          (table) => {
            table.dropColumn(columnNames.byteCountThreshold);
            table.dropColumn(columnNames.wincLimitation);
            table.dropColumn(columnNames.limitationInterval);
            table.dropColumn(columnNames.limitationIntervalUnit);
          }
        );
      },
    });
  }
}

export class ArPaymentMigrator extends Migrator {
  constructor(private readonly knex: Knex) {
    super();
  }

  private pendingPaymentTables(tableBuilder: Knex.TableBuilder) {
    tableBuilder.string(columnNames.transactionId).notNullable().primary();
    tableBuilder.string(columnNames.tokenType).notNullable();

    tableBuilder.string(columnNames.transactionQuantity).notNullable();
    tableBuilder.string(columnNames.winstonCreditAmount).notNullable();

    tableBuilder.string(columnNames.destinationAddress).notNullable();
    tableBuilder.string(columnNames.destinationAddressType).notNullable();

    tableBuilder
      .timestamp(columnNames.createdDate)
      .notNullable()
      .defaultTo(this.knex.fn.now());
  }

  public migrate() {
    return this.operate({
      name: "migrate to crypto payment",
      operation: async () => {
        await this.knex.schema.createTable(
          tableNames.pendingPaymentTransaction,
          (table) => {
            this.pendingPaymentTables(table);
          }
        );

        await this.knex.schema.createTable(
          tableNames.failedPaymentTransaction,
          (table) => {
            this.pendingPaymentTables(table);

            table
              .timestamp(columnNames.failedDate)
              .notNullable()
              .defaultTo(this.knex.fn.now());
            table.string(columnNames.failedReason).notNullable();
          }
        );

        await this.knex.schema.createTable(
          tableNames.creditedPaymentTransaction,

          (table) => {
            this.pendingPaymentTables(table);

            table.string(columnNames.blockHeight).notNullable().index();
            table
              .timestamp(columnNames.creditedDate)
              .notNullable()
              .defaultTo(this.knex.fn.now())
              .index();
          }
        );
      },
    });
  }

  public rollback() {
    return this.operate({
      name: "rollback from crypto payment",
      operation: async () => {
        await this.knex.schema.dropTableIfExists(
          tableNames.pendingPaymentTransaction
        );
        await this.knex.schema.dropTableIfExists(
          tableNames.failedPaymentTransaction
        );
        await this.knex.schema.dropTableIfExists(
          tableNames.creditedPaymentTransaction
        );
      },
    });
  }
}

export class DelegatedPaymentsMigrator extends Migrator {
  constructor(private readonly knex: Knex) {
    super();
  }

  private delegatedPaymentTables(tableBuilder: Knex.TableBuilder) {
    tableBuilder.string(columnNames.approvalDataItemId).primary();
    tableBuilder.string(columnNames.approvedAddress).notNullable().index();
    tableBuilder.string(columnNames.payingAddress).notNullable().index();
    tableBuilder.string(columnNames.approvedWincAmount).notNullable();
    tableBuilder
      .string(columnNames.usedWincAmount)
      .notNullable()
      .defaultTo("0");
    tableBuilder
      .timestamp(columnNames.creationDate)
      .notNullable()
      .defaultTo(this.knex.fn.now());
    tableBuilder.timestamp(columnNames.expirationDate).nullable();
  }

  public migrate() {
    return this.operate({
      name: "migrate to delegated payments",
      operation: async () => {
        await this.knex.schema.createTable(
          tableNames.delegatedPaymentApproval,
          (table) => {
            this.delegatedPaymentTables(table);
          }
        );

        await this.knex.schema.createTable(
          tableNames.inactiveDelegatedPaymentApproval,
          (table) => {
            this.delegatedPaymentTables(table);
            table.string(columnNames.inactiveReason).notNullable();
            table.string(columnNames.revokeDataItemId).nullable().index();
            table
              .timestamp(columnNames.inactiveDate)
              .notNullable()
              .defaultTo(this.knex.fn.now());
          }
        );

        await this.knex.schema.alterTable(
          tableNames.balanceReservation,
          (table) => {
            table.jsonb(columnNames.overflowSpend).nullable();
          }
        );

        // Create a GIN index on the JSONB column when it is not null
        await this.knex.raw(`
          CREATE INDEX ${columnNames.overflowSpend}_${columnNames.payingAddress}_idx 
          ON ${tableNames.balanceReservation} 
          USING GIN (${columnNames.overflowSpend} jsonb_path_ops)
          WHERE ${columnNames.overflowSpend} IS NOT NULL;
        `);
      },
    });
  }

  public rollback() {
    return this.operate({
      name: "rollback from delegated payments",
      operation: async () => {
        await this.knex.schema.dropTableIfExists(
          tableNames.delegatedPaymentApproval
        );
        await this.knex.schema.dropTableIfExists(
          tableNames.inactiveDelegatedPaymentApproval
        );
        await this.knex.schema.alterTable(
          tableNames.balanceReservation,
          (table) => {
            table.dropColumn(columnNames.overflowSpend);
          }
        );
      },
    });
  }
}

export class ArNSPurchaseMigrator extends Migrator {
  constructor(private readonly knex: Knex) {
    super();
  }

  private arNSReceiptTables(tableBuilder: Knex.TableBuilder) {
    tableBuilder.string(columnNames.owner).notNullable().index();
    tableBuilder.string(columnNames.name).notNullable();
    tableBuilder.string(columnNames.intent).notNullable();
    tableBuilder.decimal(columnNames.usdArRate).notNullable();
    tableBuilder.decimal(columnNames.usdArioRate).notNullable();

    tableBuilder.string(columnNames.wincQty).notNullable();
    tableBuilder.string(columnNames.mARIOQty).notNullable();

    tableBuilder
      .timestamp(columnNames.createdDate)
      .notNullable()
      .defaultTo(this.knex.fn.now());

    tableBuilder.string(columnNames.type).nullable();
    tableBuilder.integer(columnNames.years).nullable();
    tableBuilder.string(columnNames.processId).nullable();
    tableBuilder.integer(columnNames.increaseQty).nullable();
  }

  public migrate() {
    return this.operate({
      name: "migrate to buy arns name",
      operation: async () => {
        await this.knex.schema.createTable(
          tableNames.arNSPurchaseReceipt,
          (table) => {
            table.string(columnNames.nonce).primary();
            this.arNSReceiptTables(table);
          }
        );

        await this.knex.schema.createTable(
          tableNames.failedArNSPurchase,
          (table) => {
            this.arNSReceiptTables(table);
            table.string(columnNames.nonce).index();
            table
              .timestamp(columnNames.failedDate)
              .notNullable()
              .defaultTo(this.knex.fn.now());
            table.string(columnNames.failedReason).notNullable();
          }
        );
      },
    });
  }

  public rollback() {
    return this.operate({
      name: "rollback from arns purchase",
      operation: async () => {
        await this.knex.schema.dropTableIfExists(
          tableNames.arNSPurchaseReceipt
        );
        await this.knex.schema.dropTableIfExists(tableNames.failedArNSPurchase);
      },
    });
  }
}

export class ArNSPurchaseQuoteMigrator extends Migrator {
  constructor(private readonly knex: Knex) {
    super();
  }

  public migrate() {
    return this.operate({
      name: "migrate to buy arns purchase quote",
      operation: async () => {
        await this.knex.schema.createTable(
          tableNames.arNSPurchaseQuote,
          (table) => {
            table.string(columnNames.nonce).primary();

            table.string(columnNames.owner).notNullable().index();
            table.string(columnNames.name).notNullable();
            table.string(columnNames.intent).notNullable();
            table.decimal(columnNames.usdArRate).notNullable();
            table.decimal(columnNames.usdArioRate).notNullable();

            table.string(columnNames.wincQty).notNullable();
            table.string(columnNames.mARIOQty).notNullable();

            table.string(columnNames.type).nullable();
            table.integer(columnNames.years).nullable();
            table.string(columnNames.processId).nullable();
            table.integer(columnNames.increaseQty).nullable();

            table.string(columnNames.excessWinc).nullable();

            table
              .timestamp(columnNames.quoteCreationDate)
              .notNullable()
              .defaultTo(this.knex.fn.now());

            table.timestamp(columnNames.quoteExpirationDate).notNullable();
            table.string(columnNames.paymentProvider).notNullable();
            table.integer(columnNames.paymentAmount).notNullable();
            table.integer(columnNames.quotedPaymentAmount).notNullable();
            table.string(columnNames.currencyType).notNullable();
          }
        );

        await this.knex.schema.alterTable(
          tableNames.arNSPurchaseReceipt,
          (table) => {
            table.timestamp(columnNames.quoteCreationDate).nullable();
            table.timestamp(columnNames.quoteExpirationDate).nullable();
            table.string(columnNames.paymentProvider).nullable();
            table.integer(columnNames.paymentAmount).nullable();
            table.integer(columnNames.quotedPaymentAmount).nullable();
            table.string(columnNames.currencyType).nullable();
            table.string(columnNames.excessWinc).nullable();
          }
        );

        await this.knex.schema.alterTable(
          tableNames.failedArNSPurchase,
          (table) => {
            table.timestamp(columnNames.quoteCreationDate).nullable();
            table.timestamp(columnNames.quoteExpirationDate).nullable();
            table.string(columnNames.paymentProvider).nullable();
            table.integer(columnNames.paymentAmount).nullable();
            table.integer(columnNames.quotedPaymentAmount).nullable();
            table.string(columnNames.currencyType).nullable();
            table.string(columnNames.excessWinc).nullable();
          }
        );
      },
    });
  }

  public rollback() {
    return this.operate({
      name: "rollback from arns purchase quote",
      operation: async () => {
        await this.knex.schema.dropTableIfExists(tableNames.arNSPurchaseQuote);

        await this.knex.schema.alterTable(
          tableNames.arNSPurchaseReceipt,
          (table) => {
            table.dropColumn(columnNames.quoteCreationDate);
            table.dropColumn(columnNames.quoteExpirationDate);
            table.dropColumn(columnNames.paymentProvider);
            table.dropColumn(columnNames.paymentAmount);
            table.dropColumn(columnNames.quotedPaymentAmount);
            table.dropColumn(columnNames.currencyType);
            table.dropColumn(columnNames.excessWinc);
          }
        );

        await this.knex.schema.alterTable(
          tableNames.failedArNSPurchase,
          (table) => {
            table.dropColumn(columnNames.quoteCreationDate);
            table.dropColumn(columnNames.quoteExpirationDate);
            table.dropColumn(columnNames.paymentProvider);
            table.dropColumn(columnNames.paymentAmount);
            table.dropColumn(columnNames.quotedPaymentAmount);
            table.dropColumn(columnNames.currencyType);
            table.dropColumn(columnNames.excessWinc);
          }
        );
      },
    });
  }
}

export class ArNSPurchaseStoreMessageIdMigrator extends Migrator {
  constructor(private readonly knex: Knex) {
    super();
  }

  public migrate() {
    return this.operate({
      name: "migrate to buy arns purchase store message id",
      operation: async () => {
        await this.knex.schema.alterTable(
          tableNames.arNSPurchaseReceipt,
          (table) => {
            table.string(columnNames.messageId).nullable();
          }
        );
        await this.knex.schema.alterTable(
          tableNames.failedArNSPurchase,
          (table) => {
            table.string(columnNames.messageId).nullable();
          }
        );
      },
    });
  }

  public rollback() {
    return this.operate({
      name: "rollback from buy arns purchase store message id",
      operation: async () => {
        await this.knex.schema.alterTable(
          tableNames.arNSPurchaseReceipt,
          (table) => {
            table.dropColumn(columnNames.messageId);
          }
        );
        await this.knex.schema.alterTable(
          tableNames.failedArNSPurchase,
          (table) => {
            table.dropColumn(columnNames.messageId);
          }
        );
      },
    });
  }
}

export class DelegatedArNSPurchasesMigrator extends Migrator {
  constructor(private readonly knex: Knex) {
    super();
  }

  public migrate() {
    return this.operate({
      name: "migrate to delegated arns purchases",
      operation: async () => {
        await this.knex.schema.alterTable(
          tableNames.arNSPurchaseReceipt,
          (table) => {
            table.string(columnNames.paidBy).nullable();
            table.jsonb(columnNames.overflowSpend).nullable();
          }
        );

        // Create a GIN index on the JSONB column when it is not null
        await this.knex.raw(`
          CREATE INDEX ${columnNames.overflowSpend}_${columnNames.payingAddress}_arns_idx 
          ON ${tableNames.arNSPurchaseReceipt} 
          USING GIN (${columnNames.overflowSpend} jsonb_path_ops)
          WHERE ${columnNames.overflowSpend} IS NOT NULL;
        `);

        await this.knex.schema.alterTable(
          tableNames.failedArNSPurchase,
          (table) => {
            table.string(columnNames.paidBy).nullable();
            table.jsonb(columnNames.overflowSpend).nullable();
          }
        );
      },
    });
  }

  public rollback() {
    return this.operate({
      name: "rollback from delegated arns purchases",
      operation: async () => {
        await this.knex.schema.alterTable(
          tableNames.arNSPurchaseReceipt,
          (table) => {
            table.dropColumn(columnNames.paidBy);
            table.dropColumn(columnNames.overflowSpend);
          }
        );
        await this.knex.schema.alterTable(
          tableNames.failedArNSPurchase,
          (table) => {
            table.dropColumn(columnNames.paidBy);
            table.dropColumn(columnNames.overflowSpend);
          }
        );
      },
    });
  }
}

export class KyveFeeMigrator extends Migrator {
  constructor(private readonly knex: Knex) {
    super();
  }

  public migrate() {
    return this.operate({
      name: "migrate to add kyve fee columns",
      operation: async () => {
        const kyveTurboInfraFeeDBInsert: PaymentAdjustmentCatalogDBInsert = {
          catalog_id: randomUUID(),
          adjustment_name: "Kyve Turbo Infrastructure Fee",
          adjustment_description:
            "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
          operator: "multiply",
          operator_magnitude: "0.5", // 50% KYVE network fee
          adjustment_exclusivity: "inclusive_kyve",
        };
        await this.knex(tableNames.paymentAdjustmentCatalog).insert(
          kyveTurboInfraFeeDBInsert
        );
      },
    });
  }

  public rollback(): Promise<void> {
    return this.operate({
      name: "rollback from add kyve fee columns",
      operation: async () => {
        await this.knex(tableNames.paymentAdjustmentCatalog)
          .where("adjustment_name", "Kyve Turbo Infrastructure Fee")
          .del();
      },
    });
  }
}
