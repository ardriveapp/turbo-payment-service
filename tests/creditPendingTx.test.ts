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
import { expect } from "chai";
import { stub } from "sinon";

import { tableNames } from "../src/database/dbConstants";
import {
  CreditedPaymentTransactionDBResult,
  FailedPaymentTransactionDBResult,
  PendingPaymentTransactionDBResult,
  UserDBResult,
} from "../src/database/dbTypes";
import { creditPendingTransactionsHandler } from "../src/jobs/creditPendingTx";
import {
  dbTestHelper,
  gatewayMap,
  paymentDatabase,
} from "./helpers/testHelpers";

describe("creditPendingTransactionsHandler", () => {
  it("should run successfully when there are no pending payment transactions", async () => {
    await dbTestHelper
      .knex<PendingPaymentTransactionDBResult>(
        tableNames.pendingPaymentTransaction
      )
      .truncate();
    await creditPendingTransactionsHandler();
  });

  it("should run successfully when there is a pending payment transaction that is still pending", async () => {
    const testId = "unique test id pending job handler to still pending";
    await dbTestHelper.insertStubPendingPaymentTransaction({
      transaction_id: testId,
    });

    stub(gatewayMap.arweave, "getTransactionStatus").resolves({
      status: "pending",
    });
    await creditPendingTransactionsHandler({ gatewayMap });

    const results = await paymentDatabase[
      "writer"
    ]<PendingPaymentTransactionDBResult>(tableNames.pendingPaymentTransaction)
      .where({
        transaction_id: testId,
      })
      // clean up the pending table when we check expectations
      .del()
      .returning("*");

    // expect the transaction to still have been pending in the database
    expect(results.length).to.equal(1);
  });

  it("should update a pending transaction successfully when it is now confirmed", async () => {
    const testId = "unique test id pending job handler to be confirmed";
    const userAddress =
      "unique test address for confirming pending transaction handler";

    await dbTestHelper.insertStubPendingPaymentTransaction({
      transaction_id: testId,
      destination_address: userAddress,
    });

    stub(gatewayMap.arweave, "getTransactionStatus").resolves({
      status: "confirmed",
      blockHeight: 100,
    });
    await creditPendingTransactionsHandler({ gatewayMap });

    const results = await paymentDatabase[
      "writer"
    ]<PendingPaymentTransactionDBResult>(
      tableNames.pendingPaymentTransaction
    ).where({
      transaction_id: testId,
    });

    // expect the transaction to be moved to the credited table
    expect(results.length).to.equal(0);

    const creditedResults = await paymentDatabase[
      "writer"
    ]<CreditedPaymentTransactionDBResult>(
      tableNames.creditedPaymentTransaction
    ).where({
      transaction_id: testId,
    });

    expect(creditedResults.length).to.equal(1);
    expect(creditedResults[0].block_height).to.equal("100");

    // Expect the user to have been created with updated balance
    const user = await dbTestHelper
      .knex<UserDBResult>(tableNames.user)
      .where({
        user_address: userAddress,
      })
      .first();
    expect(user?.winston_credit_balance).to.equal("100");
  });

  it("should not update a fresh pending transaction when it is not found from the gateway", async () => {
    const testId = "unique test id pending job handler to be failed not found";
    const userAddress =
      "unique test address for pending to failed handler test not found ";

    await dbTestHelper.insertStubPendingPaymentTransaction({
      transaction_id: testId,
      destination_address: userAddress,
    });

    stub(gatewayMap.arweave, "getTransactionStatus").resolves({
      status: "not found",
    });
    await creditPendingTransactionsHandler({ gatewayMap });

    const results = await dbTestHelper
      .knex<PendingPaymentTransactionDBResult>(
        tableNames.pendingPaymentTransaction
      )
      .where({
        transaction_id: testId,
      });

    // expect the transaction to still have been pending in the database
    expect(results.length).to.equal(1);

    // Expect the user's balance NOT have been updated
    const user = await dbTestHelper
      .knex<UserDBResult>(tableNames.user)
      .where({
        user_address: userAddress,
      })
      .first();
    expect(user).to.be.undefined;
  });

  it("should update a pending transaction to failed when it is not found from the gateway 2 days later", async () => {
    const testId = "unique test id pending job handler to be failed";
    const userAddress =
      "unique test address for pending to failed handler test";

    await dbTestHelper.insertStubPendingPaymentTransaction({
      transaction_id: testId,
      destination_address: userAddress,
      created_date: new Date(
        Date.now() - 1000 * 60 * 60 * 24 * 2
      ).toISOString(), // 2 days ago
    });

    stub(gatewayMap.arweave, "getTransactionStatus").resolves({
      status: "not found",
    });
    await creditPendingTransactionsHandler({ gatewayMap });

    const results = await dbTestHelper
      .knex<PendingPaymentTransactionDBResult>(
        tableNames.pendingPaymentTransaction
      )
      .where({
        transaction_id: testId,
      });

    // expect the transaction to have been moved off of the pending table
    expect(results.length).to.equal(0);

    const failedResults = await paymentDatabase[
      "writer"
    ]<FailedPaymentTransactionDBResult>(
      tableNames.failedPaymentTransaction
    ).where({
      transaction_id: testId,
    });

    // expect the transaction to have been been moved to the failed table
    expect(failedResults.length).to.equal(1);

    // Expect the user's balance NOT have been updated
    const user = await dbTestHelper
      .knex<UserDBResult>(tableNames.user)
      .where({
        user_address: userAddress,
      })
      .first();
    expect(user).to.be.undefined;
  });
});
