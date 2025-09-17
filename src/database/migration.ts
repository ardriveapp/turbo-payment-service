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

import { promoCodeBackfills } from "../constants";
import globalLogger from "../logger";
import { Winston } from "../types";
import { tableNames } from "./dbConstants";
import {
  AuditLogDBResult,
  BalanceReservationDBInsert,
  BalanceReservationDBResult,
  PaymentAdjustmentCatalogDBInsert,
  PaymentAdjustmentCatalogDBResult,
  PaymentAdjustmentDBInsert,
  PaymentAdjustmentDBResult,
  PaymentReceiptDBResult,
  SingleUseCodePaymentCatalogDBInsert,
  SingleUseCodePaymentCatalogDBResult,
  UploadAdjustmentCatalogDBInsert,
  UploadAdjustmentCatalogDBResult,
  UploadAdjustmentDBInsert,
  UploadAdjustmentDBResult,
} from "./dbTypes";

export async function backfillBalanceReservations(knex: Knex) {
  globalLogger.debug("Starting balance reservation backfill...");
  const backfillStartTime = Date.now();
  const isoTimestampOfSubsidy = "2023-07-18T20:20:35.000Z";
  const uploadAuditLogsSinceSubsidy = await knex<AuditLogDBResult>(
    tableNames.auditLog
  )
    .where("change_reason", "upload")
    .andWhere("audit_date", ">", isoTimestampOfSubsidy);

  globalLogger.debug("Backfilling balance reservations from audit log:", {
    lengthOfAuditLogs: uploadAuditLogsSinceSubsidy.length,
  });

  const subsidyPercentageAsDecimal = 0.6;

  // @ts-expect-error - At time of backfill, these types were compatible. They were changed in Promo Code Migration
  const balResInsertsAndAdjustments: [
    BalanceReservationDBInsert,
    Omit<UploadAdjustmentDBInsert, "reservation_id">
  ][] = uploadAuditLogsSinceSubsidy.map(
    ({ winston_credit_amount, user_address, change_id, audit_date }) => {
      // remove negative from audit log winc value
      const adjustedWinc = new Winston(winston_credit_amount.replace(/^-/, ""));

      // Reverse the subsidy calculation
      const adjustmentAmount = adjustedWinc.times(
        subsidyPercentageAsDecimal / (1 - subsidyPercentageAsDecimal)
      );

      // Reverse the `adjustmentAmount` calculation to get the original `winc`
      const originalAmount = adjustedWinc.plus(adjustmentAmount);
      return [
        {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          data_item_id: change_id!,
          reservation_id: randomUUID(),
          user_address,
          reserved_winc_amount: adjustedWinc.toString(),
          network_winc_amount: originalAmount.toString(),
          reserved_date: audit_date,
        },
        {
          adjustment_name: "FWD Research July 2023 Subsidy",
          adjustment_description: "A 60% discount for uploads over 500KiB",
          operator: "multiply",
          operator_magnitude: 0.4,
          adjusted_winc_amount: `-${adjustmentAmount.toString()}`,
          adjustment_index: 0,
          adjustment_date: audit_date,
        },
      ];
    }
  );

  const reservationBatchInsertResult = await knex
    .batchInsert<BalanceReservationDBInsert>(
      tableNames.balanceReservation,
      balResInsertsAndAdjustments.map(([balRes]) => balRes),
      100
    )
    .returning("reservation_id");

  const adjustmentInserts = balResInsertsAndAdjustments.map(([, adj], i) => {
    return {
      ...adj,
      reservation_id: reservationBatchInsertResult[i].reservation_id,
    };
  });

  await knex.batchInsert(tableNames.uploadAdjustment, adjustmentInserts, 100);

  globalLogger.debug("Finished balance reservation backfill!", {
    backfillMs: Date.now() - backfillStartTime,
  });
}

export async function addFwdResearchSubsidyUploadCatalogs(knex: Knex) {
  const julAugDbInsert: UploadAdjustmentCatalogDBInsert = {
    catalog_id: randomUUID(),
    adjustment_start_date: new Date("2023-07-15T00:00:00.000Z").toISOString(),
    adjustment_end_date: new Date("2023-08-15T00:00:00.000Z").toISOString(),
    adjustment_name: "FWD Research July - August '23 Upload Subsidy",
    adjustment_description: "A 60% discount for uploads",
    operator: "multiply",
    operator_magnitude: "0.4",
  };
  await knex<UploadAdjustmentCatalogDBResult>(
    tableNames.uploadAdjustmentCatalog
  ).insert(julAugDbInsert);

  const augSepDbInsert: UploadAdjustmentCatalogDBInsert = {
    catalog_id: randomUUID(),
    adjustment_start_date: new Date("2023-08-15T00:00:00.000Z").toISOString(),
    adjustment_end_date: new Date("2023-09-15T00:00:00.000Z").toISOString(),
    adjustment_name: "FWD Research August - September '23 Upload Subsidy",
    adjustment_description: "A 52.25% discount for uploads",
    operator: "multiply",
    operator_magnitude: "0.475",
  };
  await knex<UploadAdjustmentCatalogDBResult>(
    tableNames.uploadAdjustmentCatalog
  ).insert(augSepDbInsert);

  const sepOctDbInsert: UploadAdjustmentCatalogDBInsert = {
    catalog_id: randomUUID(),
    adjustment_start_date: new Date("2023-09-15T00:00:00.000Z").toISOString(),
    adjustment_end_date: new Date("2023-10-15T00:00:00.000Z").toISOString(),
    adjustment_name: "FWD Research September - October '23 Upload Subsidy",
    adjustment_description: "A 45% discount for uploads",
    operator: "multiply",
    operator_magnitude: "0.55",
  };
  await knex<UploadAdjustmentCatalogDBResult>(
    tableNames.uploadAdjustmentCatalog
  ).insert(sepOctDbInsert);

  const octNovDbInsert: UploadAdjustmentCatalogDBInsert = {
    catalog_id: randomUUID(),
    adjustment_start_date: new Date("2023-10-15T00:00:00.000Z").toISOString(),
    adjustment_end_date: new Date("2023-11-15T00:00:00.000Z").toISOString(),
    adjustment_name: "FWD Research October - November '23 Upload Subsidy",
    adjustment_description: "A 37.5% discount for uploads",
    operator: "multiply",
    operator_magnitude: "0.625",
  };
  await knex<UploadAdjustmentCatalogDBResult>(
    tableNames.uploadAdjustmentCatalog
  ).insert(octNovDbInsert);

  const novDecDbInsert: UploadAdjustmentCatalogDBInsert = {
    catalog_id: randomUUID(),
    adjustment_start_date: new Date("2023-11-15T00:00:00.000Z").toISOString(),
    adjustment_end_date: new Date("2023-12-15T00:00:00.000Z").toISOString(),
    adjustment_name: "FWD Research November - December '23 Upload Subsidy",
    adjustment_description: "A 30% discount for uploads",
    operator: "multiply",
    operator_magnitude: "0.7",
  };
  await knex<UploadAdjustmentCatalogDBResult>(
    tableNames.uploadAdjustmentCatalog
  ).insert(novDecDbInsert);

  const decJanDbInsert: UploadAdjustmentCatalogDBInsert = {
    catalog_id: randomUUID(),
    adjustment_start_date: new Date("2023-12-15T00:00:00.000Z").toISOString(),
    adjustment_end_date: new Date("2024-01-15T00:00:00.000Z").toISOString(),
    adjustment_name: "FWD Research December '23 - January '24 Upload Subsidy",
    adjustment_description: "A 22.5% discount for uploads",
    operator: "multiply",
    operator_magnitude: "0.775",
  };
  await knex<UploadAdjustmentCatalogDBResult>(
    tableNames.uploadAdjustmentCatalog
  ).insert(decJanDbInsert);

  const janFebDbInsert: UploadAdjustmentCatalogDBInsert = {
    catalog_id: randomUUID(),
    adjustment_start_date: new Date("2024-01-15T00:00:00.000Z").toISOString(),
    adjustment_end_date: new Date("2024-02-15T00:00:00.000Z").toISOString(),
    adjustment_name: "FWD Research January - February '24 Upload Subsidy",
    adjustment_description: "A 15% discount for uploads",
    operator: "multiply",
    operator_magnitude: "0.85",
  };
  await knex<UploadAdjustmentCatalogDBResult>(
    tableNames.uploadAdjustmentCatalog
  ).insert(janFebDbInsert);

  const febMarDbInsert: UploadAdjustmentCatalogDBInsert = {
    catalog_id: randomUUID(),
    adjustment_start_date: new Date("2024-02-15T00:00:00.000Z").toISOString(),
    adjustment_end_date: new Date("2024-03-15T00:00:00.000Z").toISOString(),
    adjustment_name: "FWD Research February - March '24 Upload Subsidy",
    adjustment_description: "A 7.5% discount for uploads",
    operator: "multiply",
    operator_magnitude: "0.925",
  };
  await knex<UploadAdjustmentCatalogDBResult>(
    tableNames.uploadAdjustmentCatalog
  ).insert(febMarDbInsert);
}

export async function backfillUploadAdjustments(knex: Knex) {
  globalLogger.debug("Starting upload adjustment backfill...");
  const backfillStartTime = Date.now();

  const uploadAdjustmentCatalogs = await knex<UploadAdjustmentCatalogDBResult>(
    tableNames.uploadAdjustmentCatalog
  );
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const julyAugCatalogId = uploadAdjustmentCatalogs.find(
    ({ adjustment_name }) =>
      adjustment_name === "FWD Research July - August '23 Upload Subsidy"
  )!.catalog_id;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const augSepCatalogId = uploadAdjustmentCatalogs.find(
    ({ adjustment_name }) =>
      adjustment_name === "FWD Research August - September '23 Upload Subsidy"
  )!.catalog_id;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const sepOctCatalogId = uploadAdjustmentCatalogs.find(
    ({ adjustment_name }) =>
      adjustment_name === "FWD Research September - October '23 Upload Subsidy"
  )!.catalog_id;

  const balanceReservations = await knex<BalanceReservationDBResult>(
    tableNames.balanceReservation
  );

  const resIdToAddress = balanceReservations.reduce(
    (acc, { reservation_id, user_address }) => {
      acc[reservation_id] = user_address;
      return acc;
    },
    {} as Record<string, string>
  );

  // Delete all upload adjustments that were created before promo code migration
  const uploadAdjustments = await knex<UploadAdjustmentDBResult>(
    tableNames.uploadAdjustment
  )
    .where("catalog_id", "PRE-PROMO-CODE-MIGRATION-CATALOG-ID")
    .delete()
    .returning("*");

  // Setup DB Inserts with new catalog IDs and user addresses
  const uploadAdjustmentDbInserts: UploadAdjustmentDBInsert[] =
    uploadAdjustments.map(
      ({ reservation_id, adjustment_date, ...otherColumns }) => {
        const catalog_id =
          new Date(adjustment_date) < new Date("2023-08-15T00:00:00.000Z")
            ? julyAugCatalogId
            : new Date(adjustment_date) < new Date("2023-09-15T00:00:00.000Z")
            ? augSepCatalogId
            : sepOctCatalogId;
        return {
          ...otherColumns,
          reservation_id,
          catalog_id,
          user_address: resIdToAddress[reservation_id],
        };
      }
    );

  // Batch insert backfilled upload adjustments
  await knex.batchInsert("upload_adjustment", uploadAdjustmentDbInserts, 1000);

  // Backfill all receipts and quotes with the new quoted_payment_amount column
  const updateQuery = (table: string) =>
    `update ${table} set quoted_payment_amount = payment_amount where quoted_payment_amount = '0';`;
  const tablesToUpdate = [
    "payment_receipt",
    "top_up_quote",
    "failed_top_up_quote",
    "chargeback_receipt",
  ];
  await Promise.all(
    tablesToUpdate.map((table) => knex.raw(updateQuery(table)))
  );

  globalLogger.debug("Finished upload adjustment backfill!", {
    backfillMs: Date.now() - backfillStartTime,
  });
}

export async function addToken2049PromoCodeEvent(knex: Knex): Promise<void> {
  const singleUseCatalogDBInsert: SingleUseCodePaymentCatalogDBInsert = {
    catalog_id: randomUUID(),
    adjustment_name: "Token2049 Singapore Promo Code",
    adjustment_description:
      "20% off of top up purchase, can be used once per user.",
    operator: "multiply",
    operator_magnitude: "0.8",
    adjustment_exclusivity: "exclusive",
    code_value: promoCodeBackfills.welcomeTwentyPercentOff,
    // Adjustment start date defaulted to Now() on the migration to dev/prod. For local testing environment, we need to set it to a date in the past
    adjustment_start_date: "2023-01-01T00:00:00.000Z",
  };
  await knex<SingleUseCodePaymentCatalogDBResult>(
    tableNames.singleUseCodePaymentAdjustmentCatalog
  ).insert(singleUseCatalogDBInsert);
}

export const dateOfTwentyThreeFourTurboInfraFeeDeploy = new Date(
  "2023-08-23T19:36:00.000Z"
);
export const dateOfTwentyThreePctTurboInfraFeeDeploy = new Date(
  "2023-07-13T16:15:00.000Z"
);

export async function addTurboInfraFee(knex: Knex): Promise<void> {
  const turboInfraFeeDBInsert: PaymentAdjustmentCatalogDBInsert = {
    catalog_id: randomUUID(),
    adjustment_name: "Turbo Infrastructure Fee",
    adjustment_description:
      "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
    operator: "multiply",
    operator_magnitude: "0.766",
    adjustment_exclusivity: "inclusive",
    adjustment_start_date:
      dateOfTwentyThreeFourTurboInfraFeeDeploy.toISOString(),
    // No end date as of yet
  };
  await knex<SingleUseCodePaymentCatalogDBResult>(
    tableNames.paymentAdjustmentCatalog
  ).insert(turboInfraFeeDBInsert);

  // Applied From Jul 13 - Aug 23
  const twentyThreePercentInfraFeeDBInsert: PaymentAdjustmentCatalogDBInsert = {
    catalog_id: randomUUID(),
    adjustment_name: "Turbo Infrastructure Fee",
    adjustment_description:
      "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
    operator: "multiply",
    operator_magnitude: "0.77",
    adjustment_exclusivity: "inclusive",
    adjustment_start_date:
      dateOfTwentyThreePctTurboInfraFeeDeploy.toISOString(),
    adjustment_end_date: dateOfTwentyThreeFourTurboInfraFeeDeploy.toISOString(),
  };
  await knex<SingleUseCodePaymentCatalogDBResult>(
    tableNames.paymentAdjustmentCatalog
  ).insert(twentyThreePercentInfraFeeDBInsert);

  // Applied Before Jul 13
  const twentyPercentInfraFeeDBInsert: PaymentAdjustmentCatalogDBInsert = {
    catalog_id: randomUUID(),
    adjustment_name: "Turbo Infrastructure Fee",
    adjustment_description:
      "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
    operator: "multiply",
    operator_magnitude: "0.8",
    adjustment_exclusivity: "inclusive",
    adjustment_start_date: "2023-01-01T00:00:00.000Z", // Date before payment service launch
    adjustment_end_date: dateOfTwentyThreePctTurboInfraFeeDeploy.toISOString(),
  };
  await knex<SingleUseCodePaymentCatalogDBResult>(
    tableNames.paymentAdjustmentCatalog
  ).insert(twentyPercentInfraFeeDBInsert);
}

async function findInfraFeeCatalogIds(
  knex: Knex
): Promise<[string, string, string]> {
  const turboInfraFeeAdjustmentCatalogs =
    await knex<PaymentAdjustmentCatalogDBResult>(
      "payment_adjustment_catalog"
    ).where({
      adjustment_name: "Turbo Infrastructure Fee",
    });

  const catalogIdForTwentyPctFee = turboInfraFeeAdjustmentCatalogs.find(
    ({ operator_magnitude }) => operator_magnitude === "0.8"
  )?.catalog_id;
  const catalogIdForTwentyThreePctFee = turboInfraFeeAdjustmentCatalogs.find(
    ({ operator_magnitude }) => operator_magnitude === "0.77"
  )?.catalog_id;
  const catalogIdForTwentyThreeFourPctFee =
    turboInfraFeeAdjustmentCatalogs.find(
      ({ operator_magnitude }) => operator_magnitude === "0.766"
    )?.catalog_id;

  if (
    catalogIdForTwentyPctFee === undefined ||
    catalogIdForTwentyThreePctFee === undefined ||
    catalogIdForTwentyThreeFourPctFee === undefined
  ) {
    throw new Error("Could not find Turbo Infra Fee Adjustment Catalogs");
  }

  return [
    catalogIdForTwentyPctFee,
    catalogIdForTwentyThreePctFee,
    catalogIdForTwentyThreeFourPctFee,
  ];
}

export async function backfillTurboInfraFee(knex: Knex) {
  const [
    catalogIdForTwentyPctFee,
    catalogIdForTwentyThreePctFee,
    catalogIdForTwentyThreeFourPctFee,
  ] = await findInfraFeeCatalogIds(knex);

  const paymentReceipts = await knex<PaymentReceiptDBResult>("payment_receipt");

  // Catch any Turbo Infra Fee Adjustments added between code deploy and backfill
  const overlappedAdjustments = await knex<PaymentAdjustmentDBResult>(
    "payment_adjustment"
  ).where({ catalog_id: catalogIdForTwentyThreeFourPctFee });

  const paymentReceiptsToBackfill = paymentReceipts.filter(
    ({ top_up_quote_id }) =>
      !overlappedAdjustments.some(
        ({ top_up_quote_id: overlappedTopUpQuoteId }) =>
          overlappedTopUpQuoteId === top_up_quote_id
      )
  );

  const paymentAdjustments: PaymentAdjustmentDBInsert[] =
    paymentReceiptsToBackfill.map(
      ({
        top_up_quote_id,
        payment_amount,
        quote_creation_date,
        destination_address,
        quoted_payment_amount,
      }) => {
        const quoteDate = new Date(quote_creation_date);

        const [multiplier, catalog_id] =
          quoteDate < dateOfTwentyThreePctTurboInfraFeeDeploy
            ? [0.2, catalogIdForTwentyPctFee]
            : quoteDate < dateOfTwentyThreePctTurboInfraFeeDeploy
            ? [0.23, catalogIdForTwentyThreePctFee]
            : [0.234, catalogIdForTwentyThreeFourPctFee];

        const adjustmentAmount = new Winston(payment_amount).times(multiplier);

        return {
          catalog_id,
          top_up_quote_id,
          adjusted_payment_amount: `-${adjustmentAmount.toString()}`,
          adjusted_currency_type: "usd",
          // If the payment amount is the same as the quoted payment amount, then this is the first and only adjustment
          // Otherwise the TOKEN2049 promo code was applied and this is the second adjustment
          adjustment_index: payment_amount === quoted_payment_amount ? 0 : 1,
          adjustment_date: quote_creation_date,
          user_address: destination_address,
        };
      }
    );

  await knex.batchInsert<PaymentAdjustmentDBResult>(
    "payment_adjustment",
    paymentAdjustments
  );
}

export async function rollbackInfraFeeBackfill(knex: Knex) {
  const infraFeeCatalogIds = await findInfraFeeCatalogIds(knex);

  await knex<PaymentAdjustmentDBResult>("payment_adjustment")
    .whereIn("catalog_id", infraFeeCatalogIds)
    .del();
}
