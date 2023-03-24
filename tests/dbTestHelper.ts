import { expect } from "chai";
import { Knex } from "knex";

import { tableNames } from "../src/database/dbConstants";
import { TopUpQuoteDBInsert, UserAddress } from "../src/database/dbTypes";
import { PostgresDatabase } from "../src/database/postgres";

type TableNameKeys = keyof typeof tableNames;
type TableNameValues = (typeof tableNames)[TableNameKeys];

export const stubArweaveUserAddress: UserAddress =
  "1234567890123456789012345678901231234567890";

const stubDate = new Date("2023-03-23 16:20:00").toISOString();

function stubTopUpQuoteInsert({
  top_up_quote_id = "The Stubbiest Top Up Quote",
}: {
  top_up_quote_id?: string;
}): TopUpQuoteDBInsert {
  return {
    amount: "100",
    currency_type: "usd",
    destination_address: stubArweaveUserAddress,
    destination_address_type: "arweave",
    quote_expiration_date: stubDate,
    payment_provider: "stripe",
    top_up_quote_id,
    winston_credit_amount: "1337",
  };
}

export class DbTestHelper {
  constructor(public readonly db: PostgresDatabase) {}

  private get knex(): Knex {
    return this.db["knex"];
  }

  public async insertStubTopUpQuote(insertParams: {
    top_up_quote_id?: string;
  }): Promise<void> {
    console.log("inserting");
    return this.knex(tableNames.topUpQuote).insert(
      stubTopUpQuoteInsert(insertParams)
    );
  }

  public async cleanUpEntityInDb(
    tableName: TableNameValues,
    pk_val: string
  ): Promise<void> {
    const where = { [`${tableName}_id`]: pk_val };

    await this.knex(tableName).where(where).del();
    expect((await this.knex(tableName).where(where)).length).to.equal(0);
  }
}
