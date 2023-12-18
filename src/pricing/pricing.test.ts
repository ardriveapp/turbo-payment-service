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
import { expect } from "chai";
import { SinonFakeTimers, stub, useFakeTimers } from "sinon";

import { expectedArPrices } from "../../tests/helpers/stubs";
import {
  expectAsyncErrorThrow,
  removeCatalogIdMap,
} from "../../tests/helpers/testHelpers";
import { tableNames } from "../database/dbConstants";
import {
  SingleUseCodePaymentCatalogDBInsert,
  SingleUseCodePaymentCatalogDBResult,
  UploadAdjustmentCatalogDBInsert,
} from "../database/dbTypes";
import { PostgresDatabase } from "../database/postgres";
import { ByteCount, Winston } from "../types";
import { Payment } from "../types/payment";
import { roundToArweaveChunkSize } from "../utils/roundToChunkSize";
import {
  CoingeckoArweaveToFiatOracle,
  ReadThroughArweaveToFiatOracle,
} from "./oracles/arweaveToFiatOracle";
import { ReadThroughBytesToWinstonOracle } from "./oracles/bytesToWinstonOracle";
import { TurboPricingService } from "./pricing";

describe("TurboPricingService class", () => {
  const paymentDatabase = new PostgresDatabase();
  const bytesToWinstonOracle = new ReadThroughBytesToWinstonOracle({});
  const oracle = new CoingeckoArweaveToFiatOracle();
  const arweaveToFiatOracle = new ReadThroughArweaveToFiatOracle({ oracle });

  const pricing = new TurboPricingService({
    arweaveToFiatOracle,
    bytesToWinstonOracle,
    paymentDatabase,
  });

  describe("getWCForBytes", () => {
    describe("with a date before the subsidy", () => {
      let clock: SinonFakeTimers;
      before(() => {
        const fakeDateBeforeSubsidy = new Date("2021-01-01T00:00:00.000Z");
        clock = useFakeTimers(fakeDateBeforeSubsidy.getTime());
      });
      after(() => {
        clock.restore();
      });

      beforeEach(() => {
        stub(bytesToWinstonOracle, "getWinstonForBytes").callsFake((b) =>
          // Return the given byte count (rounded as chunks) as the stubbed price
          Promise.resolve(new Winston(b.toString()))
        );
      });

      it("returns the expected price for a given byte count", async () => {
        const price = await pricing.getWCForBytes(ByteCount(100));
        expect(price.finalPrice.winc.toString()).to.equal(
          `${roundToArweaveChunkSize(ByteCount(100))}`
        );
      });

      describe("when a flat discount upload promo event is applied...", () => {
        const startDate = new Date("2001-01-02T00:00:00.000Z");
        const endDate = new Date("2001-01-04T00:00:00.000Z");

        const dateBeforeDiscount = new Date("2001-01-01T00:00:00.000Z");
        const dateDuringDiscount = new Date("2001-01-03T00:00:00.000Z");
        const dateAfterDiscount = new Date("2001-01-05T00:00:00.000Z");

        before(async () => {
          const insert: UploadAdjustmentCatalogDBInsert = {
            adjustment_name: "Turbo 1 million winc off",
            catalog_id: "best_stub_id_ever",
            operator: "add",
            adjustment_end_date: endDate.toISOString(),
            operator_magnitude: "-1000000",
            adjustment_start_date: startDate.toISOString(),
          };

          await paymentDatabase["writer"](
            tableNames.uploadAdjustmentCatalog
          ).insert(insert);
        });

        after(async () => {
          await paymentDatabase["writer"](tableNames.uploadAdjustmentCatalog)
            .where({ catalog_id: "best_stub_id_ever_2" })
            .delete();
        });

        afterEach(() => {
          clock.restore();
        });

        it("returns the expected price for a given byte count larger than the discount", async () => {
          clock = useFakeTimers(dateDuringDiscount.getTime());

          const { adjustments, finalPrice, networkPrice } =
            await pricing.getWCForBytes(ByteCount(1_048_576));

          expect(finalPrice.winc.toString()).to.equal("48576");
          expect(networkPrice.winc.toString()).to.equal("1048576");

          expect(adjustments).to.deep.equal([
            {
              adjustmentAmount: new Winston(-1000000),
              description: "",
              name: "Turbo 1 million winc off",
              operator: "add",
              operatorMagnitude: -1000000,
              catalogId: "best_stub_id_ever",
            },
          ]);
        });

        it("returns the expected price for a given byte count smaller than the discount", async () => {
          clock = useFakeTimers(dateDuringDiscount.getTime());

          const { adjustments, finalPrice, networkPrice } =
            await pricing.getWCForBytes(ByteCount(256 * 1024));

          expect(finalPrice.winc.toString()).to.equal("0");
          expect(networkPrice.winc.toString()).to.equal("262144");

          expect(adjustments).to.deep.equal([
            {
              adjustmentAmount: new Winston(-262144),
              description: "",
              name: "Turbo 1 million winc off",
              operator: "add",
              operatorMagnitude: -1000000,
              catalogId: "best_stub_id_ever",
            },
          ]);
        });

        it("returns the expected price for a given byte count when the discount is expired", async () => {
          clock = useFakeTimers(dateAfterDiscount.getTime());

          const { adjustments, finalPrice, networkPrice } =
            await pricing.getWCForBytes(ByteCount(256 * 1024));

          expect(finalPrice.winc.toString()).to.equal("262144");
          expect(networkPrice.winc.toString()).to.equal("262144");

          expect(adjustments).to.deep.equal([]);
        });

        it("returns the expected price for a given byte before the discount has started", async () => {
          clock = useFakeTimers(dateBeforeDiscount.getTime());

          const { adjustments, finalPrice, networkPrice } =
            await pricing.getWCForBytes(ByteCount(256 * 1024));

          expect(finalPrice.winc.toString()).to.equal("262144");
          expect(networkPrice.winc.toString()).to.equal("262144");

          expect(adjustments).to.deep.equal([]);
        });
      });
    });

    describe("with dates throughout the subsidy", () => {
      beforeEach(() => {
        stub(bytesToWinstonOracle, "getWinstonForBytes").resolves(
          new Winston(100)
        );
      });

      const datesAndExpectedPrices = [
        ["2023-07-14", "100"],
        ["2023-07-15", "40"],
        ["2023-08-14", "40"],
        ["2023-08-15", "47"],
        ["2023-09-14", "47"],
        ["2023-09-15", "55"],
        ["2023-10-14", "55"],
        ["2023-10-15", "62"],
        ["2023-11-14", "62"],
        ["2023-11-15", "70"],
        ["2023-12-14", "70"],
        ["2023-12-15", "77"],
        ["2024-01-14", "77"],
        ["2024-01-15", "85"],
        ["2024-02-14", "85"],
        ["2024-02-15", "92"],
        ["2024-03-14", "92"],
        ["2024-03-15", "100"],
      ];

      for (const [date, expectedPrice] of datesAndExpectedPrices) {
        it(`returns the expected price (${expectedPrice}) for date "${date}" of the fwd research promotion`, async () => {
          const fakeDate = new Date(`${date}T00:00:00.000Z`);
          const clock = useFakeTimers(fakeDate.getTime());

          const price = await pricing.getWCForBytes(ByteCount(100));
          expect(price.finalPrice.winc.toString()).to.equal(expectedPrice);

          clock.restore();
        });
      }
    });
  });

  describe("getWCForPayment", () => {
    beforeEach(() => {
      stub(oracle, "getFiatPricesForOneAR").resolves(expectedArPrices.arweave);
    });

    it("returns the expected price for a given payment", async () => {
      const {
        actualPaymentAmount,
        adjustments,
        inclusiveAdjustments,
        finalPrice,
        quotedPaymentAmount,
      } = await pricing.getWCForPayment({
        payment: new Payment({ amount: 100, type: "usd" }),
        promoCodes: [],
      });

      expect(finalPrice.winc.toString()).to.equal("109686609687");
      expect(actualPaymentAmount).to.equal(100);
      expect(quotedPaymentAmount).to.equal(100);
      expect(adjustments).to.deep.equal([]);
      expect(inclusiveAdjustments.map(removeCatalogIdMap)).to.deep.equal([
        {
          adjustmentAmount: -23,
          currencyType: "usd",
          description:
            "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
          name: "Turbo Infrastructure Fee",
          operator: "multiply",
          operatorMagnitude: 0.766,
        },
      ]);
    });

    it("returns the expected price for a given payment with a 20% promo event applied", async () => {
      const pricingTestPromoCode = "pricingTestPromoCode";
      const pricingTestPromoCodeCatalogId = "pricingTestPromoCodeCatalogId";

      await paymentDatabase["writer"]<SingleUseCodePaymentCatalogDBResult>(
        tableNames.singleUseCodePaymentAdjustmentCatalog
      ).insert({
        code_value: pricingTestPromoCode,
        adjustment_exclusivity: "exclusive",
        adjustment_name: "Pricing Test Promo Code",
        catalog_id: pricingTestPromoCodeCatalogId,
        operator: "multiply",
        operator_magnitude: "0.8",
        adjustment_start_date: "2021-01-01T00:00:00.000Z", // some time in the past
      });

      const price = await pricing.getWCForPayment({
        payment: new Payment({ amount: 100, type: "usd" }),
        promoCodes: [pricingTestPromoCode],
        userAddress: "StubUniqueUserAddress",
      });
      expect(price.finalPrice.winc.toString()).to.equal("109686609687");
      expect(price.actualPaymentAmount).to.equal(80);
      expect(price.quotedPaymentAmount).to.equal(100);
      expect(price.adjustments.map(removeCatalogIdMap)).to.deep.equal([
        {
          adjustmentAmount: -20,
          currencyType: "usd",
          description: "",
          name: "Pricing Test Promo Code",
          operator: "multiply",
          operatorMagnitude: 0.8,
          promoCode: "pricingTestPromoCode",
        },
      ]);
      expect(price.inclusiveAdjustments.map(removeCatalogIdMap)).to.deep.equal([
        {
          adjustmentAmount: -23,
          currencyType: "usd",
          description:
            "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
          name: "Turbo Infrastructure Fee",
          operator: "multiply",
          operatorMagnitude: 0.766,
        },
      ]);
      expect(price.adjustments[0].catalogId).to.be.a("string");
    });

    it("returns the expected price for a zero amount", async () => {
      const price = await pricing.getWCForPayment({
        payment: new Payment({ amount: 0, type: "usd" }),
      });
      expect(price.finalPrice.winc.toString()).to.equal("0");
      expect(price.actualPaymentAmount).to.equal(0);
      expect(price.quotedPaymentAmount).to.equal(0);
      expect(price.adjustments).to.deep.equal([]);
      expect(price.inclusiveAdjustments.map(removeCatalogIdMap)).to.deep.equal([
        {
          adjustmentAmount: 0,
          currencyType: "usd",
          description:
            "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
          name: "Turbo Infrastructure Fee",
          operator: "multiply",
          operatorMagnitude: 0.766,
        },
      ]);
    });

    it("returns the expected price for one us cent", async () => {
      const price = await pricing.getWCForPayment({
        payment: new Payment({ amount: 1, type: "usd" }),
      });
      expect(price.finalPrice.winc.toString()).to.equal("1424501425");
      expect(price.actualPaymentAmount).to.equal(1);
      expect(price.quotedPaymentAmount).to.equal(1);
      expect(price.adjustments).to.deep.equal([]);
      expect(price.inclusiveAdjustments.map(removeCatalogIdMap)).to.deep.equal([
        {
          adjustmentAmount: 0,
          currencyType: "usd",
          description:
            "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
          name: "Turbo Infrastructure Fee",
          operator: "multiply",
          operatorMagnitude: 0.766,
        },
      ]);
    });

    it("returns the expected price for forty nine us cents", async () => {
      const price = await pricing.getWCForPayment({
        payment: new Payment({ amount: 49, type: "usd" }),
      });
      expect(price.finalPrice.winc.toString()).to.equal("54131054131");
      expect(price.actualPaymentAmount).to.equal(49);
      expect(price.quotedPaymentAmount).to.equal(49);
      expect(price.adjustments).to.deep.equal([]);
      expect(price.inclusiveAdjustments.map(removeCatalogIdMap)).to.deep.equal([
        {
          adjustmentAmount: -11,
          currencyType: "usd",
          description:
            "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
          name: "Turbo Infrastructure Fee",
          operator: "multiply",
          operatorMagnitude: 0.766,
        },
      ]);
    });

    describe("when a flat discount promo event is applied...", () => {
      before(async () => {
        const insert: SingleUseCodePaymentCatalogDBInsert = {
          adjustment_name: "Turbo One Dollar Off",
          catalog_id: "best_stub_id",
          code_value: "TURBO_ONE_DOLLAR_OFF",
          operator: "add",
          operator_magnitude: "-100",
          adjustment_exclusivity: "exclusive",
          adjustment_start_date: new Date(
            "2021-01-01T00:00:00.000Z"
          ).toISOString(),
        };

        await paymentDatabase["writer"](
          tableNames.singleUseCodePaymentAdjustmentCatalog
        ).insert(insert);
      });

      it("returns the expected price for a given payment", async () => {
        const price = await pricing.getWCForPayment({
          payment: new Payment({ amount: 200, type: "usd" }),
          promoCodes: ["TURBO_ONE_DOLLAR_OFF"],
          userAddress: "StubUniqueUserAddress",
        });
        expect(price.finalPrice.winc.toString()).to.equal("217948717949");
        expect(price.actualPaymentAmount).to.equal(100);
        expect(price.quotedPaymentAmount).to.equal(200);
        expect(price.adjustments.map(removeCatalogIdMap)).to.deep.equal([
          {
            adjustmentAmount: -100,
            currencyType: "usd",
            description: "",
            name: "Turbo One Dollar Off",
            operator: "add",
            operatorMagnitude: -100,
            promoCode: "TURBO_ONE_DOLLAR_OFF",
          },
        ]);
        expect(
          price.inclusiveAdjustments.map(removeCatalogIdMap)
        ).to.deep.equal([
          {
            adjustmentAmount: -47,
            currencyType: "usd",
            description:
              "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
            name: "Turbo Infrastructure Fee",
            operator: "multiply",
            operatorMagnitude: 0.766,
          },
        ]);
      });

      it("returns the expected minimum price for a given payment when a discount would go below the minimum", async () => {
        const price = await pricing.getWCForPayment({
          payment: new Payment({ amount: 80, type: "usd" }),
          promoCodes: ["TURBO_ONE_DOLLAR_OFF"],
          userAddress: "StubUniqueUserAddress",
        });
        expect(price.finalPrice.winc.toString()).to.equal("86894586895");
        expect(price.actualPaymentAmount).to.equal(0);
        expect(price.quotedPaymentAmount).to.equal(80);
        expect(price.adjustments.map(removeCatalogIdMap)).to.deep.equal([
          {
            adjustmentAmount: -80,
            currencyType: "usd",
            description: "",
            name: "Turbo One Dollar Off",
            operator: "add",
            operatorMagnitude: -100,
            promoCode: "TURBO_ONE_DOLLAR_OFF",
          },
        ]);
        expect(
          price.inclusiveAdjustments.map(removeCatalogIdMap)
        ).to.deep.equal([
          {
            adjustmentAmount: -19,
            currencyType: "usd",
            description:
              "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
            name: "Turbo Infrastructure Fee",
            operator: "multiply",
            operatorMagnitude: 0.766,
          },
        ]);
      });

      it("returns the expected response for a given payment when a discount is applied in JPY", async () => {
        const price = await pricing.getWCForPayment({
          payment: new Payment({ amount: 10000, type: "jpy" }),
          promoCodes: ["TURBO_ONE_DOLLAR_OFF"],
          userAddress: "StubUniqueUserAddress",
        });
        expect(price.finalPrice.winc.toString()).to.equal("8120256116694");
        expect(price.actualPaymentAmount).to.equal(9866);
        expect(price.quotedPaymentAmount).to.equal(10000);
        expect(price.adjustments.map(removeCatalogIdMap)).to.deep.equal([
          {
            adjustmentAmount: -134,
            currencyType: "jpy",
            description: "",
            name: "Turbo One Dollar Off",
            operator: "add",
            operatorMagnitude: -100,
            promoCode: "TURBO_ONE_DOLLAR_OFF",
          },
        ]);
        expect(
          price.inclusiveAdjustments.map(removeCatalogIdMap)
        ).to.deep.equal([
          {
            adjustmentAmount: -2340,
            currencyType: "jpy",
            description:
              "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
            name: "Turbo Infrastructure Fee",
            operator: "multiply",
            operatorMagnitude: 0.766,
          },
        ]);
      });
    });

    describe("with a pilot referral event added", () => {
      const pricingPilotReferralPromoCode = "pricingPilotReferralPromoCode";
      const pricingPilotReferralPromoCodeCatalogId =
        "pricingPilotReferralPromoCodeCatalogId";

      before(async () => {
        await paymentDatabase["writer"]<SingleUseCodePaymentCatalogDBResult>(
          tableNames.singleUseCodePaymentAdjustmentCatalog
        ).insert({
          code_value: pricingPilotReferralPromoCode,
          adjustment_exclusivity: "exclusive",
          adjustment_name: "Pricing Pilot Referral Promo Code",
          catalog_id: pricingPilotReferralPromoCodeCatalogId,
          target_user_group: "new",
          max_uses: 10,
          minimum_payment_amount: 1000,
          operator: "add",
          operator_magnitude: "-500",
          adjustment_start_date: "2023-09-20T16:47:37.660Z", // in the past
        });
      });

      it("returns the expected adjustment when within minimum payment amount", async () => {
        const userAddress = "userAddress";

        const {
          actualPaymentAmount,
          adjustments,
          finalPrice,
          inclusiveAdjustments,
          quotedPaymentAmount,
        } = await pricing.getWCForPayment({
          payment: new Payment({ amount: 1000, type: "usd" }),
          promoCodes: [pricingPilotReferralPromoCode],
          userAddress,
        });

        expect(finalPrice.winc.toString()).to.equal("1091168091168");
        expect(actualPaymentAmount).to.equal(500);
        expect(quotedPaymentAmount).to.equal(1000);
        expect(adjustments.map(removeCatalogIdMap)).to.deep.equal([
          {
            adjustmentAmount: -500,
            currencyType: "usd",
            description: "",
            name: "Pricing Pilot Referral Promo Code",
            operator: "add",
            operatorMagnitude: -500,
            promoCode: "pricingPilotReferralPromoCode",
          },
        ]);
        expect(inclusiveAdjustments.map(removeCatalogIdMap)).to.deep.equal([
          {
            adjustmentAmount: -234,
            currencyType: "usd",
            description:
              "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
            name: "Turbo Infrastructure Fee",
            operator: "multiply",
            operatorMagnitude: 0.766,
          },
        ]);
      });

      it("errors as expected when used below minimum payment amount", async () => {
        await expectAsyncErrorThrow({
          promiseToError: pricing.getWCForPayment({
            payment: new Payment({ amount: 999, type: "usd" }),
            promoCodes: [pricingPilotReferralPromoCode],
            userAddress: "userAddress",
          }),
          errorMessage:
            "The promo code 'pricingPilotReferralPromoCode' can only used on payments above '1000'",
          errorType: "PaymentAmountTooSmallForPromoCode",
        });
      });

      it("errors as expected when used below minimum payment amount in JPY", async () => {
        await expectAsyncErrorThrow({
          promiseToError: pricing.getWCForPayment({
            payment: new Payment({ amount: 500, type: "jpy" }),
            promoCodes: [pricingPilotReferralPromoCode],
            userAddress: "userAddress",
          }),
          errorMessage:
            "The promo code 'pricingPilotReferralPromoCode' can only used on payments above '1000'",
          errorType: "PaymentAmountTooSmallForPromoCode",
        });
      });
    });

    describe("with an event with max discount is added", () => {
      const pricingMaxDiscountPromoCode = "pricingMaxDiscountPromoCode";
      const pricingMaxDiscountPromoCodeCatalogId =
        "pricingMaxDiscountPromoCodeCatalogId";

      before(async () => {
        await paymentDatabase["writer"]<SingleUseCodePaymentCatalogDBResult>(
          tableNames.singleUseCodePaymentAdjustmentCatalog
        ).insert({
          code_value: pricingMaxDiscountPromoCode,
          adjustment_exclusivity: "exclusive",
          adjustment_name: "Pricing Max Discount Promo Code",
          catalog_id: pricingMaxDiscountPromoCodeCatalogId,
          maximum_discount_amount: 10_00,
          operator: "multiply",
          operator_magnitude: "0.50",
          adjustment_start_date: "2023-09-20T16:47:37.660Z", // in the past
        });
      });

      it("returns the expected adjustment when within maximum discount amount", async () => {
        const {
          actualPaymentAmount,
          adjustments,
          finalPrice,
          inclusiveAdjustments,
          quotedPaymentAmount,
        } = await pricing.getWCForPayment({
          payment: new Payment({ amount: 1000, type: "usd" }),
          promoCodes: [pricingMaxDiscountPromoCode],
          userAddress: "userAddress",
        });

        expect(finalPrice.winc.toString()).to.equal("1091168091168");
        expect(actualPaymentAmount).to.equal(500);
        expect(quotedPaymentAmount).to.equal(1000);
        expect(adjustments.map(removeCatalogIdMap)).to.deep.equal([
          {
            adjustmentAmount: -500,
            currencyType: "usd",
            description: "",
            maxDiscount: 10_00,
            name: "Pricing Max Discount Promo Code",
            operator: "multiply",
            operatorMagnitude: 0.5,
            promoCode: "pricingMaxDiscountPromoCode",
          },
        ]);
        expect(inclusiveAdjustments.map(removeCatalogIdMap)).to.deep.equal([
          {
            adjustmentAmount: -234,
            currencyType: "usd",
            description:
              "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
            name: "Turbo Infrastructure Fee",
            operator: "multiply",
            operatorMagnitude: 0.766,
          },
        ]);
      });

      it("returns the expected adjustment when above maximum discount amount", async () => {
        const {
          actualPaymentAmount,
          adjustments,
          finalPrice,
          inclusiveAdjustments,
          quotedPaymentAmount,
        } = await pricing.getWCForPayment({
          payment: new Payment({ amount: 100_00, type: "usd" }),
          promoCodes: [pricingMaxDiscountPromoCode],
          userAddress: "userAddress",
        });

        expect(finalPrice.winc.toString()).to.equal("10911680911681");
        expect(actualPaymentAmount).to.equal(90_00);
        expect(quotedPaymentAmount).to.equal(100_00);
        expect(adjustments.map(removeCatalogIdMap)).to.deep.equal([
          {
            adjustmentAmount: -10_00,
            currencyType: "usd",
            description: "",
            maxDiscount: 10_00,
            name: "Pricing Max Discount Promo Code",
            operator: "multiply",
            operatorMagnitude: 0.5,
            promoCode: "pricingMaxDiscountPromoCode",
          },
        ]);
        expect(inclusiveAdjustments.map(removeCatalogIdMap)).to.deep.equal([
          {
            adjustmentAmount: -2340,
            currencyType: "usd",
            description:
              "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
            name: "Turbo Infrastructure Fee",
            operator: "multiply",
            operatorMagnitude: 0.766,
          },
        ]);
      });
    });
  });
});
