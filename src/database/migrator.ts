/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
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
import { SingleUseCodePaymentCatalogDBInsert } from "./dbTypes";
import { backfillTurboInfraFee, rollbackInfraFeeBackfill } from "./migration";

export abstract class Migrator {
  protected async operate({
    name,
    operation,
  }: {
    name: string;
    operation: () => Promise<void>;
  }) {
    globalLogger.info(`Starting ${name}...`);
    const startTime = Date.now();

    await operation();

    globalLogger.info(`Finished ${name}!`, {
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
