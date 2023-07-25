import { Knex } from "knex";

import { tableNames } from "./dbConstants";
import { PriceAdjustmentDBResult } from "./dbTypes";

export async function addFwdResearchSubsidyPromotion(pg: Knex): Promise<void> {
  if (process.env.NODE_ENV !== "test") {
    await pg<PriceAdjustmentDBResult>(tableNames.priceAdjustment).insert({
      adjustment_applicability: "apply_to_all",
      adjustment_id: "fwd_research_july_2023_upload_subsidy",
      adjustment_start_date: new Date("2023-07-15").toISOString(),
      adjustment_expiration_date: new Date("2023-08-15").toISOString(),
      adjustment_name: "FWD Research July '23 Upload Subsidy",
      adjustment_scope: "upload",
      adjustment_operator: "multiply",
      adjustment_value: 0.6,
    });

    await pg<PriceAdjustmentDBResult>(tableNames.priceAdjustment).insert({
      adjustment_applicability: "apply_to_all",
      adjustment_id: "fwd_research_august_2023_upload_subsidy",
      adjustment_start_date: new Date("2023-08-15").toISOString(),
      adjustment_expiration_date: new Date("2023-09-15").toISOString(),
      adjustment_name: "FWD Research August '23 Upload Subsidy",
      adjustment_scope: "upload",
      adjustment_operator: "multiply",
      adjustment_value: 0.525,
    });

    await pg<PriceAdjustmentDBResult>(tableNames.priceAdjustment).insert({
      adjustment_applicability: "apply_to_all",
      adjustment_id: "fwd_research_september_2023_upload_subsidy",
      adjustment_start_date: new Date("2023-09-15").toISOString(),
      adjustment_expiration_date: new Date("2023-10-15").toISOString(),
      adjustment_name: "FWD Research September '23 Upload Subsidy",
      adjustment_scope: "upload",
      adjustment_operator: "multiply",
      adjustment_value: 0.45,
    });

    await pg<PriceAdjustmentDBResult>(tableNames.priceAdjustment).insert({
      adjustment_applicability: "apply_to_all",
      adjustment_id: "fwd_research_october_2023_upload_subsidy",
      adjustment_start_date: new Date("2023-10-15").toISOString(),
      adjustment_expiration_date: new Date("2023-11-15").toISOString(),
      adjustment_name: "FWD Research October '23 Upload Subsidy",
      adjustment_scope: "upload",
      adjustment_operator: "multiply",
      adjustment_value: 0.375,
    });

    await pg<PriceAdjustmentDBResult>(tableNames.priceAdjustment).insert({
      adjustment_applicability: "apply_to_all",
      adjustment_id: "fwd_research_november_2023_upload_subsidy",
      adjustment_start_date: new Date("2023-11-15").toISOString(),
      adjustment_expiration_date: new Date("2023-12-15").toISOString(),
      adjustment_name: "FWD Research November '23 Upload Subsidy",
      adjustment_scope: "upload",
      adjustment_operator: "multiply",
      adjustment_value: 0.3,
    });

    await pg<PriceAdjustmentDBResult>(tableNames.priceAdjustment).insert({
      adjustment_applicability: "apply_to_all",
      adjustment_id: "fwd_research_december_2023_upload_subsidy",
      adjustment_start_date: new Date("2023-12-15").toISOString(),
      adjustment_expiration_date: new Date("2024-01-15").toISOString(),
      adjustment_name: "FWD Research December '23 Upload Subsidy",
      adjustment_scope: "upload",
      adjustment_operator: "multiply",
      adjustment_value: 0.225,
    });

    await pg<PriceAdjustmentDBResult>(tableNames.priceAdjustment).insert({
      adjustment_applicability: "apply_to_all",
      adjustment_id: "fwd_research_january_2023_upload_subsidy",
      adjustment_start_date: new Date("2024-01-15").toISOString(),
      adjustment_expiration_date: new Date("2024-02-15").toISOString(),
      adjustment_name: "FWD Research January '24 Upload Subsidy",
      adjustment_scope: "upload",
      adjustment_operator: "multiply",
      adjustment_value: 0.15,
    });

    await pg<PriceAdjustmentDBResult>(tableNames.priceAdjustment).insert({
      adjustment_applicability: "apply_to_all",
      adjustment_id: "fwd_research_february_2023_upload_subsidy",
      adjustment_start_date: new Date("2024-02-15").toISOString(),
      adjustment_expiration_date: new Date("2024-03-15").toISOString(),
      adjustment_name: "FWD Research February '24 Upload Subsidy",
      adjustment_scope: "upload",
      adjustment_operator: "multiply",
      adjustment_value: 0.075,
    });
  }
}
