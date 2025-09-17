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

import {
  DelegatedPaymentApproval,
  PaymentAdjustment,
} from "../database/dbTypes";
import { W } from "../types";
import {
  formatRawIntent,
  formatStripeArNSPurchaseDescription,
  remainingWincAmountFromApprovals,
  toStripeMetadata,
} from "./common";

describe("remainingWincAmountFromApprovals", () => {
  const stubApproval = {
    approvalDataItemId: "0x123",
    payingAddress: "0x123",
    approvedAddress: "0x123",
    creationDate: new Date().toISOString(),
  } as const;
  it("should return the remaining amount from approvals", () => {
    const approvals: DelegatedPaymentApproval[] = [
      {
        approvedWincAmount: W(100),
        usedWincAmount: W(50),
        ...stubApproval,
      },
      { approvedWincAmount: W(200), usedWincAmount: W(100), ...stubApproval },
    ];
    expect(remainingWincAmountFromApprovals(approvals).toString()).to.equal(
      "150"
    );
  });
});

describe("formatRawIntent", () => {
  const testCases = [
    { rawIntent: "buy-name", expected: "Buy-Name" },
    { rawIntent: "BUY-NAME", expected: "Buy-Name" },
    { rawIntent: "BuY-nAMe", expected: "Buy-Name" },
    { rawIntent: "buy-record", expected: "Buy-Record" },
    {
      rawIntent: "Increase-undername-LIMIT",
      expected: "Increase-Undername-Limit",
    },
    { rawIntent: "upgrade-name", expected: "Upgrade-Name" },
    { rawIntent: "EXTEND-lease", expected: "Extend-Lease" },
  ];

  testCases.forEach(({ rawIntent, expected }) => {
    it(`should format ${rawIntent} correctly`, () => {
      const formattedIntent = formatRawIntent(rawIntent);
      expect(formattedIntent).to.equal(expected);
    });
  });
  it("should throw an error for missing intent", () => {
    const intent = "";
    expect(() => formatRawIntent(intent)).to.throw(
      "Missing required parameter: intent"
    );
  });
  it("should throw an error for non-string intent", () => {
    const intent = 123 as unknown as string;
    expect(() => formatRawIntent(intent)).to.throw(
      "Missing required parameter: intent"
    );
  });
  it("should throw an error for empty intent", () => {
    const intent = " ";
    expect(() => formatRawIntent(intent)).to.throw("Invalid intent parameter");
  });
});

describe("formatStripeArNSPurchaseDescription", () => {
  it("should format all fields correctly", () => {
    const result = formatStripeArNSPurchaseDescription({
      intent: "Purchase",
      name: "Domain",
      type: "Premium",
      years: 2,
      increaseQty: 1,
      processId: "abc123",
    });

    expect(result).to.equal(
      "Intent: Purchase, Name: Domain, Type: Premium, Years: 2, Increase Qty: 1, Process Id: abc123"
    );
  });

  it("should omit undefined optional fields", () => {
    const result = formatStripeArNSPurchaseDescription({
      intent: "Renew",
      name: "Example",
    });

    expect(result).to.equal("Intent: Renew, Name: Example");
  });

  it("should include some optional fields when present", () => {
    const result = formatStripeArNSPurchaseDescription({
      intent: "Update",
      name: "Service",
      years: 3,
    });

    expect(result).to.equal("Intent: Update, Name: Service, Years: 3");
  });
});

describe("toStripeMetadata", () => {
  it("should correctly format adjustments into stripe metadata", () => {
    const adjustments = [
      { name: "referral_bonus", adjustmentAmount: 1234 },
      { name: "early_discount", adjustmentAmount: 5678 },
    ];

    const baseMetadata = {
      wincQty: 10000,
      referer: "0xabc",
    };

    const result = toStripeMetadata({ adjustments, baseMetadata });

    expect(result).to.deep.equal({
      wincQty: 10000,
      referer: "0xabc",
      adj0_referral_bonus: "1234",
      adj1_early_discount: "5678",
    });
  });

  it("should truncate keys longer than 40 characters", () => {
    const adjustments = [
      {
        name: "a_very_long_adjustment_name_that_exceeds_limit",
        adjustmentAmount: 999,
      },
    ];

    const baseMetadata = {};

    const result = toStripeMetadata({ adjustments, baseMetadata });

    const key = Object.keys(result)[0];
    expect(key.length).to.be.at.most(40);
    expect(result[key]).to.equal("999");
  });

  it("should support Winston values", () => {
    const adjustments: PaymentAdjustment[] = [
      {
        name: "winston_test",
        adjustmentAmount: W(1302313131121),
        catalogId: "test",
        currencyType: "USD",
        description: "Test adjustment",
        operator: "multiply",
        operatorMagnitude: 1.2,
      },
    ];

    const baseMetadata = {
      referer: null,
    };

    const result = toStripeMetadata({ adjustments, baseMetadata });

    expect(result.adj0_winston_test).to.equal("1302313131121");
  });

  it("should handle empty adjustments", () => {
    const baseMetadata = {
      onlyMeta: "value",
    };

    const result = toStripeMetadata({ adjustments: [], baseMetadata });

    expect(result).to.deep.equal({ onlyMeta: "value" });
  });
});
