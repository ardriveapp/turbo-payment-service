import { expect } from "chai";
import { Knex } from "knex";

export const localTestUrl = "http://localhost:1235";

interface expectAsyncErrorThrowParams {
  promiseToError: Promise<unknown>;
  // TODO: Define error types,
  // errorType: 'Error' | 'TypeError' | ...
  errorType?: string;
  errorMessage?: string;
}

/**
 * Test helper function that takes a promise and will expect a caught error
 *
 * @param promiseToError the promise on which to expect a thrown error
 * @param errorType type of error to expect, defaults to 'Error'
 * @param errorMessage exact error message to expect
 * */
export async function expectAsyncErrorThrow({
  promiseToError,
  errorType = "Error",
  errorMessage,
}: expectAsyncErrorThrowParams): Promise<void> {
  let error: null | Error = null;
  try {
    await promiseToError;
  } catch (err) {
    error = err as Error | null;
  }

  expect(error?.name).to.equal(errorType);

  if (errorMessage) {
    expect(error?.message).to.equal(errorMessage);
  }
}

type KnexRawResult = {
  command: string; // "SELECT" |
  rowCount: number; // 1
  oid: unknown; // null
  rows: { table_name: string }[]; //  [ { table_name: 'new_data_item_1' } ]
  fields: {
    name: string; // "table_name"
    tableID: number; // 13276
    columnID: number; // 3
    dataTypeID: number; // 19
    dataTypeSize: number; // 64
    dataTypeModifier: number; // -1
    format: "text";
  }[];
};

export function listTables(pg: Knex): Knex.Raw<KnexRawResult> {
  return pg.raw(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name"
  );
}
