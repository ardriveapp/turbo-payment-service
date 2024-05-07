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

import { tableNames } from "../src/database/dbConstants";
import {
  AuditLogDBResult,
  BalanceReservationDBResult,
  ChargebackReceiptDBResult,
  PaymentAdjustmentDBResult,
  PaymentReceiptDBResult,
  SingleUseCodePaymentCatalogDBResult,
  TopUpQuoteDBResult,
  UploadAdjustment,
  UploadAdjustmentDBInsert,
  UserDBResult,
} from "../src/database/dbTypes";
import { PostgresDatabase } from "../src/database/postgres";
import { FinalPrice, NetworkPrice } from "../src/pricing/price";
import { Winston } from "../src/types/winston";
import { DbTestHelper } from "./dbTestHelper";
import { stubTxId1 } from "./helpers/stubs";
import { expectAsyncErrorThrow } from "./helpers/testHelpers";

describe("PostgresDatabase class", () => {
  const db = new PostgresDatabase();
  const dbTestHelper = new DbTestHelper(db);

  const postgresTestPromoCode = "postgresTestPromoCode";
  const postgresTestPromoCodeCatalogId = "postgresTestPromoCodeCatalogId";

  before(async () => {
    await db["writer"]<SingleUseCodePaymentCatalogDBResult>(
      tableNames.singleUseCodePaymentAdjustmentCatalog
    ).insert({
      code_value: postgresTestPromoCode,
      adjustment_exclusivity: "exclusive",
      adjustment_name: "Postgres Test Promo Code",
      catalog_id: postgresTestPromoCodeCatalogId,
      operator: "multiply",
      operator_magnitude: "0.8",
    });
  });

  describe("createTopUpQuote method", () => {
    const quoteExpirationDate = new Date(
      "2023-03-23 12:34:56.789Z"
    ).toISOString();

    before(async () => {
      await db.createTopUpQuote({
        paymentAmount: 100,
        quotedPaymentAmount: 150,
        currencyType: "usd",
        destinationAddress: "XYZ",
        adjustments: [
          {
            adjustmentAmount: -50,
            catalogId: "uuid",
            currencyType: "usd",
            name: "best adjustment",
            operator: "add",
            operatorMagnitude: -50,
            description: "fifty cents off",
          },
        ],
        destinationAddressType: "arweave",
        quoteExpirationDate,
        paymentProvider: "stripe",
        topUpQuoteId: "Unique Identifier",
        winstonCreditAmount: new Winston(500),
      });
    });

    it("creates the expected top up quote in the database", async () => {
      const topUpQuote = await db["writer"]<TopUpQuoteDBResult>(
        tableNames.topUpQuote
      ).where({ top_up_quote_id: "Unique Identifier" });
      expect(topUpQuote.length).to.equal(1);

      const {
        payment_amount,
        quoted_payment_amount,
        currency_type,
        destination_address,
        destination_address_type,
        payment_provider,
        quote_creation_date,
        quote_expiration_date,
        top_up_quote_id,
        winston_credit_amount,
      } = topUpQuote[0];

      expect(payment_amount).to.equal("100");
      expect(quoted_payment_amount).to.equal("150");
      expect(currency_type).to.equal("usd");
      expect(destination_address).to.equal("XYZ");
      expect(destination_address_type).to.equal("arweave");
      expect(payment_provider).to.equal("stripe");
      expect(quote_creation_date).to.exist;
      expect(new Date(quote_expiration_date).toISOString()).to.equal(
        quoteExpirationDate
      );
      expect(top_up_quote_id).to.equal("Unique Identifier");
      expect(winston_credit_amount).to.equal("500");
    });

    it("creates the expected payment adjustment in the database", async () => {
      const paymentAdjustments = await db["writer"]<PaymentAdjustmentDBResult>(
        tableNames.paymentAdjustment
      ).where({
        top_up_quote_id: "Unique Identifier",
      });
      expect(paymentAdjustments.length).to.equal(1);

      const {
        adjusted_currency_type,
        adjusted_payment_amount,
        adjustment_date,
        adjustment_id,
        adjustment_index,
        catalog_id,
        user_address,
        top_up_quote_id,
      } = paymentAdjustments[0];

      expect(adjusted_payment_amount).to.equal("-50");
      expect(catalog_id).to.equal("uuid");
      expect(adjusted_currency_type).to.equal("usd");
      expect(user_address).to.equal("XYZ");
      expect(adjustment_index).to.equal(0);
      expect(adjustment_date).to.exist;
      expect(top_up_quote_id).to.equal("Unique Identifier");
      expect(adjustment_id).to.be.a("number");
    });
  });

  describe("getTopUpQuote method", () => {
    const pantsId = "Pants 👖";
    const shortsId = "Shorts 🩳";

    before(async () => {
      await dbTestHelper.insertStubTopUpQuote({ top_up_quote_id: pantsId });
      await dbTestHelper.insertStubTopUpQuote({ top_up_quote_id: shortsId });
    });

    it("returns the expected top up quotes", async () => {
      const pantsQuote = await db.getTopUpQuote(pantsId);
      const shortsQuote = await db.getTopUpQuote(shortsId);

      expect(pantsQuote.topUpQuoteId).to.equal(pantsId);
      expect(shortsQuote.topUpQuoteId).to.equal(shortsId);
    });

    it("errors as expected when top up quote cannot be found", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.getTopUpQuote("Non Existent ID"),
        errorMessage:
          "No top up quote found in database with ID 'Non Existent ID'",
      });
    });
  });

  describe("createPaymentReceipt method", () => {
    const newUserAddress = "New User 👶";
    const oldUserAddress = "Old User 🧓";

    const newUserTopUpId = "New Top Up ID";
    const oldUserTopUpId = "Old Top Up ID";

    const oldUserBalance = new Winston("100");
    const oldUserPaymentAmount = new Winston("500");

    before(async () => {
      // Create Payment Receipt for New User
      await dbTestHelper.insertStubTopUpQuote({
        payment_amount: "10101",
        currency_type: "can",
        destination_address: newUserAddress,
        destination_address_type: "arweave",
        top_up_quote_id: newUserTopUpId,
        winston_credit_amount: "60000",
      });
      await db.createPaymentReceipt({
        currencyType: "can",
        paymentAmount: 10101,
        topUpQuoteId: newUserTopUpId,
        paymentReceiptId: "Unique Identifier",
      });

      await dbTestHelper.insertStubUser({
        user_address: oldUserAddress,
        winston_credit_balance: oldUserBalance.toString(),
      });

      // Create Payment Receipt for Existing User
      await dbTestHelper.insertStubTopUpQuote({
        top_up_quote_id: oldUserTopUpId,
        payment_amount: "1337",
        currency_type: "fra",
        destination_address: oldUserAddress,
        destination_address_type: "arweave",
        winston_credit_amount: oldUserPaymentAmount.toString(),
      });
      await db.createPaymentReceipt({
        paymentAmount: 1337,
        currencyType: "fra",
        topUpQuoteId: oldUserTopUpId,
        paymentReceiptId: "An Existing User's Unique Identifier",
      });
    });

    it("creates the expected payment_receipt in the database entity", async () => {
      const paymentReceipt = await db["writer"]<PaymentReceiptDBResult>(
        tableNames.paymentReceipt
      ).where({ payment_receipt_id: "Unique Identifier" });
      expect(paymentReceipt.length).to.equal(1);

      const {
        payment_amount,
        currency_type,
        destination_address,
        destination_address_type,
        payment_provider,
        payment_receipt_date,
        payment_receipt_id,
        top_up_quote_id,
        winston_credit_amount,
      } = paymentReceipt[0];

      expect(payment_amount).to.equal("10101");
      expect(currency_type).to.equal("can");
      expect(destination_address).to.equal(newUserAddress);
      expect(destination_address_type).to.equal("arweave");
      expect(payment_provider).to.equal("stripe");
      expect(payment_receipt_date).to.exist;
      expect(payment_receipt_id).to.equal("Unique Identifier");
      expect(top_up_quote_id).to.equal(newUserTopUpId);
      expect(winston_credit_amount).to.equal("60000");
    });

    it("creates the expected new user when an existing user address cannot be found", async () => {
      const user = await db["writer"]<UserDBResult>(tableNames.user).where({
        user_address: newUserAddress,
      });
      expect(user.length).to.equal(1);

      const {
        promotional_info,
        user_address,
        user_address_type,
        winston_credit_balance,
      } = user[0];

      expect(promotional_info).to.deep.equal({});
      expect(user_address).to.equal(newUserAddress);
      expect(user_address_type).to.equal("arweave");
      expect(winston_credit_balance).to.equal("60000");
    });

    it("increments existing user's balance as expected", async () => {
      const oldUser = await db["writer"]<UserDBResult>(tableNames.user).where({
        user_address: oldUserAddress,
      });
      expect(oldUser.length).to.equal(1);

      expect(oldUser[0].winston_credit_balance).to.equal(
        oldUserBalance.plus(oldUserPaymentAmount).toString()
      );
    });

    it("deletes the top_up_quotes as expected", async () => {
      const topUpQuoteDbResults = await db["writer"]<TopUpQuoteDBResult>(
        tableNames.topUpQuote
      );
      const topUpIds = topUpQuoteDbResults.map((r) => r.top_up_quote_id);

      expect(topUpIds).to.not.include(newUserTopUpId);
      expect(topUpIds).to.not.include(oldUserTopUpId);
    });

    it("errors as expected when top up quote amount is mismatched", async () => {
      await dbTestHelper.insertStubTopUpQuote({
        top_up_quote_id:
          "A Top Up Quote ID That will be mismatched by currency amount",
        payment_amount: "500",
        currency_type: "any",
      });

      await expectAsyncErrorThrow({
        promiseToError: db.createPaymentReceipt({
          paymentAmount: 200,
          currencyType: "any",
          topUpQuoteId:
            "A Top Up Quote ID That will be mismatched by currency amount",
          paymentReceiptId: "This is not fine",
        }),
        errorMessage:
          "Amount from top up quote (500 any) does not match the amount paid on the payment receipt (200 any)!",
      });

      expect(
        (
          await db["writer"](tableNames.paymentReceipt).where({
            payment_receipt_id: "This is fine",
          })
        ).length
      ).to.equal(0);
    });

    it("errors as expected when top_up_quote is beyond expiration date", async () => {
      const quoteExpirationDateInThePast = new Date(
        Date.now() - 1000
      ).toISOString();

      await dbTestHelper.insertStubTopUpQuote({
        quote_expiration_date: quoteExpirationDateInThePast,
        top_up_quote_id: "Expired Quote",
        payment_amount: "1",
        currency_type: "marsToken",
      });

      await expectAsyncErrorThrow({
        promiseToError: db.createPaymentReceipt({
          paymentAmount: 1,
          currencyType: "marsToken",
          topUpQuoteId: "Expired Quote",
          paymentReceiptId: "This is a string",
        }),
        errorMessage:
          "Top up quote with id 'Expired Quote' has already been expired!",
      });

      expect(
        (
          await db["writer"](tableNames.paymentReceipt).where({
            payment_receipt_id: "This is a string",
          })
        ).length
      ).to.equal(0);
    });

    it("errors as expected when no top up quote can be found", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.createPaymentReceipt({
          paymentAmount: 1,
          currencyType: "usd",
          topUpQuoteId: "A Top Up Quote ID That will be NOT FOUND",
          paymentReceiptId: "This is fine",
        }),
        errorMessage:
          "No top up quote found in database with id 'A Top Up Quote ID That will be NOT FOUND'",
      });

      expect(
        (
          await db["writer"](tableNames.paymentReceipt).where({
            payment_receipt_id: "This is fine",
          })
        ).length
      ).to.equal(0);
    });

    it("errors as expected when 20% off promo code payment adjustment is no longer eligible", async () => {
      const userAddress = "this promo code User Address";
      const firstTopUpQuoteId = "First Top Up Quote ID";
      const secondTopUpQuoteId = "Second Top Up Quote ID";

      const promoCodeEventCatalogId = await db[
        "reader"
      ]<SingleUseCodePaymentCatalogDBResult>(
        tableNames.singleUseCodePaymentAdjustmentCatalog
      )
        .where({ code_value: postgresTestPromoCode })
        .first()
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        .then((r) => r!.catalog_id);

      await dbTestHelper.insertStubTopUpQuote({
        destination_address: userAddress,
        top_up_quote_id: firstTopUpQuoteId,
      });
      await dbTestHelper.insertStubTopUpQuote({
        destination_address: userAddress,
        top_up_quote_id: secondTopUpQuoteId,
      });
      await dbTestHelper.insertStubPaymentAdjustment({
        top_up_quote_id: firstTopUpQuoteId,
        user_address: userAddress,
        catalog_id: promoCodeEventCatalogId,
      });
      await dbTestHelper.insertStubPaymentAdjustment({
        top_up_quote_id: secondTopUpQuoteId,
        user_address: userAddress,
        catalog_id: promoCodeEventCatalogId,
      });

      await db.createPaymentReceipt({
        currencyType: "usd",
        paymentAmount: 100,
        topUpQuoteId: firstTopUpQuoteId,
        paymentReceiptId: "Unique Identifier promo code",
      });

      expect(
        (
          await db["reader"](tableNames.paymentReceipt).where({
            payment_receipt_id: "Unique Identifier promo code",
          })
        ).length
      ).to.equal(1);

      await expectAsyncErrorThrow({
        promiseToError: db.createPaymentReceipt({
          currencyType: "usd",
          paymentAmount: 100,
          topUpQuoteId: secondTopUpQuoteId,
          paymentReceiptId: "Unique Identifier second promo code ",
        }),
        errorMessage:
          "The user 'this promo code User Address' is ineligible for the promo code 'postgresTestPromoCode'",
        errorType: "UserIneligibleForPromoCode",
      });

      expect(
        (
          await db["reader"](tableNames.paymentReceipt).where({
            payment_receipt_id: "Unique Identifier second promo code ",
          })
        ).length
      ).to.equal(0);
    });
  });

  describe("getPaymentReceipt method", () => {
    const grapesId = "Grapes 🍇";
    const strawberriesId = "Strawberries 🍓";

    before(async () => {
      await dbTestHelper.insertStubPaymentReceipt({
        payment_receipt_id: grapesId,
      });
      await dbTestHelper.insertStubPaymentReceipt({
        payment_receipt_id: strawberriesId,
      });
    });

    it("returns the expected payment receipt database entities", async () => {
      const grapesReceipt = await db.getPaymentReceipt(grapesId);
      const strawberriesReceipt = await db.getPaymentReceipt(strawberriesId);

      expect(grapesReceipt.paymentReceiptId).to.equal(grapesId);
      expect(strawberriesReceipt.paymentReceiptId).to.equal(strawberriesId);
    });

    it("errors as expected when payment receipt cannot be found", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.getPaymentReceipt("Non Existent ID"),
        errorMessage:
          'No payment receipts found in database with query {"payment_receipt_id":"Non Existent ID"}!',
      });
    });
  });

  describe("createChargebackReceipt method", () => {
    const naughtyUserAddress = "Naughty User 💀";

    const naughtyUserBalance = new Winston("1000");
    const naughtyPaymentId = "A bad payment receipt ID";
    const naughtyTopUpQuoteId = "A bad top up quote ID";

    before(async () => {
      await dbTestHelper.insertStubUser({
        user_address: naughtyUserAddress,
        winston_credit_balance: naughtyUserBalance.toString(),
      });
      await dbTestHelper.insertStubPaymentReceipt({
        payment_receipt_id: naughtyPaymentId,
        top_up_quote_id: naughtyTopUpQuoteId,
        destination_address: naughtyUserAddress,
        winston_credit_amount: "100",
      });
      await db.createChargebackReceipt({
        chargebackReceiptId: "A great Unique Identifier",
        chargebackReason: "Evil",
        topUpQuoteId: naughtyTopUpQuoteId,
      });
    });

    it("creates the expected chargeback receipt in the database", async () => {
      const chargebackReceipt = await db["writer"]<ChargebackReceiptDBResult>(
        tableNames.chargebackReceipt
      ).where({
        chargeback_receipt_id: "A great Unique Identifier",
      });
      expect(chargebackReceipt.length).to.equal(1);

      const {
        payment_amount,
        currency_type,
        destination_address,
        destination_address_type,
        payment_provider,
        chargeback_receipt_date,
        chargeback_receipt_id,
        payment_receipt_id,
        winston_credit_amount,
        chargeback_reason,
      } = chargebackReceipt[0];

      expect(payment_amount).to.equal("100");
      expect(currency_type).to.equal("usd");
      expect(destination_address).to.equal(naughtyUserAddress);
      expect(destination_address_type).to.equal("arweave");
      expect(payment_provider).to.equal("stripe");
      expect(chargeback_receipt_date).to.exist;
      expect(chargeback_receipt_id).to.equal("A great Unique Identifier");
      expect(payment_receipt_id).to.equal(payment_receipt_id);
      expect(winston_credit_amount).to.equal("100");
      expect(chargeback_reason).to.equal("Evil");
    });

    it("deletes the payment_receipt entity", async () => {
      const paymentReceiptDbResults = await db[
        "writer"
      ]<PaymentReceiptDBResult>(tableNames.paymentReceipt).where({
        payment_receipt_id: naughtyPaymentId,
      });
      expect(paymentReceiptDbResults.length).to.equal(0);
    });

    it("decrements user's balance as expected", async () => {
      const oldUser = await db["writer"]<UserDBResult>(tableNames.user).where({
        user_address: naughtyUserAddress,
      });
      expect(oldUser.length).to.equal(1);

      expect(oldUser[0].winston_credit_balance).to.equal(
        naughtyUserBalance.minus(new Winston("100")).toString()
      );
    });

    it("errors as expected when no payment receipt could be found to chargeback", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.createChargebackReceipt({
          topUpQuoteId: "No ID Found!!!!!",
          chargebackReceiptId: "chargeback receipts 1",
          chargebackReason: "Stripe Dispute Webhook Event",
        }),
        errorMessage: `No payment receipts found in database with query {"top_up_quote_id":"No ID Found!!!!!"}!`,
      });

      expect(
        (
          await db["writer"](tableNames.chargebackReceipt).where({
            chargeback_receipt_id: "Great value",
          })
        ).length
      ).to.equal(0);
    });

    it("decrements user's balance and creates a chargeback even if the chargeback results in a negative balance", async () => {
      const underfundedUserAddress = "Broke 😭";
      const topUpQuoteId = "Used top up quote";
      const chargebackReceiptId = "negative balance chargeback";
      const disputedWinstonAmount = "200";

      await dbTestHelper.insertStubUser({
        user_address: underfundedUserAddress,
        winston_credit_balance: "100",
      });

      await dbTestHelper.insertStubPaymentReceipt({
        top_up_quote_id: topUpQuoteId,
        destination_address: underfundedUserAddress,
        winston_credit_amount: disputedWinstonAmount,
      });

      const negativeBalanceUserBefore = await db["writer"]<UserDBResult>(
        tableNames.user
      ).where({
        user_address: underfundedUserAddress,
      });

      const balanceBeforeChargeback = new Winston(
        negativeBalanceUserBefore[0].winston_credit_balance
      );

      await db.createChargebackReceipt({
        topUpQuoteId: topUpQuoteId,
        chargebackReceiptId: chargebackReceiptId,
        chargebackReason: "Stripe Dispute Webhook Event",
      });

      const negativeBalanceAfter = await db["writer"]<UserDBResult>(
        tableNames.user
      ).where({
        user_address: underfundedUserAddress,
      });

      const balanceAfterChargeback = new Winston(
        negativeBalanceAfter[0].winston_credit_balance
      );

      expect(balanceAfterChargeback.toString()).to.equal(
        balanceBeforeChargeback
          .minus(new Winston(disputedWinstonAmount))
          .toString()
      );

      expect(
        (
          await db["writer"](tableNames.chargebackReceipt).where({
            chargeback_receipt_id: chargebackReceiptId,
          })
        ).length
      ).to.equal(1);
    });
  });

  describe("getChargebackReceipt method", () => {
    const breadId = "Bread 🍞";
    const greensId = "Greens 🥬";

    before(async () => {
      await dbTestHelper.insertStubChargebackReceipt({
        chargeback_receipt_id: breadId,
      });
      await dbTestHelper.insertStubChargebackReceipt({
        chargeback_receipt_id: greensId,
      });
    });

    it("returns the expected chargeback receipt database entities", async () => {
      const grapesReceipt = await db.getChargebackReceipt(breadId);
      const strawberriesReceipt = await db.getChargebackReceipt(greensId);

      expect(grapesReceipt.chargebackReceiptId).to.equal(breadId);
      expect(strawberriesReceipt.chargebackReceiptId).to.equal(greensId);
    });

    it("errors as expected when chargeback receipt cannot be found", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.getChargebackReceipt("Non Existent ID"),
        errorMessage:
          "No chargeback receipt found in database with ID 'Non Existent ID'",
      });
    });
  });

  describe("getUser method", () => {
    const goodAddress = "Good 😇";
    const evilAddress = "Evil 😈";

    before(async () => {
      await dbTestHelper.insertStubUser({ user_address: goodAddress });
      await dbTestHelper.insertStubUser({ user_address: evilAddress });
    });

    it("gets the expected user database entities", async () => {
      const pantsQuote = await db.getUser(goodAddress);
      const shortsQuote = await db.getUser(evilAddress);

      expect(pantsQuote.userAddress).to.equal(goodAddress);
      expect(shortsQuote.userAddress).to.equal(evilAddress);
    });

    it("throws a warning as expected when user cannot be found", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.getUser("Non Existent Address"),
        errorType: "UserNotFoundWarning",
        errorMessage:
          "No user found in database with address 'Non Existent Address'",
      });
    });
  });

  describe("getBalance method", () => {
    const userWithBalanceAddress = "userWithBalanceAddress";

    before(async () => {
      await dbTestHelper.insertStubUser({
        user_address: userWithBalanceAddress,
        winston_credit_balance: "500",
      });
    });

    it("gets the expected user's balance", async () => {
      const userBalance = await db.getBalance(userWithBalanceAddress);
      expect(userBalance.toString()).to.equal("500");
    });

    it("throws a warning as expected when user cannot be found", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.getUser("Non Existent Address"),
        errorType: "UserNotFoundWarning",
        errorMessage:
          "No user found in database with address 'Non Existent Address'",
      });
    });
  });

  describe("getPromoInfo method", () => {
    const unicornAddress = "Unicorn 🦄";

    before(async () => {
      await dbTestHelper.insertStubUser({ user_address: unicornAddress });
    });

    it("gets the expected user database entities", async () => {
      const promoInfo = await db.getPromoInfo(unicornAddress);

      expect(promoInfo).to.deep.equal({});
    });

    it("throws a warning as expected when user cannot be found", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.getPromoInfo("Non Existent Address"),
        errorType: "UserNotFoundWarning",
        errorMessage:
          "No user found in database with address 'Non Existent Address'",
      });
    });
  });

  describe("updatePromoInfo method", () => {
    const privilegedAddress = "Privileged 🎫";

    before(async () => {
      await dbTestHelper.insertStubUser({ user_address: privilegedAddress });
    });

    it("updates a user's promotional information as expected", async () => {
      await db.updatePromoInfo(privilegedAddress, {
        arioTokenHodler: true,
        underOneHundredKiBFreeBytes: 100_000_000_000,
      });

      const promoInfo = await db.getPromoInfo(privilegedAddress);

      expect(promoInfo).to.deep.equal({
        arioTokenHodler: true,
        underOneHundredKiBFreeBytes: 100_000_000_000,
      });
    });

    it("throws a warning as expected when user cannot be found", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.updatePromoInfo("Non Existent Address", {
          newPromo: true,
        }),
        errorType: "UserNotFoundWarning",
        errorMessage:
          "No user found in database with address 'Non Existent Address'",
      });
    });
  });

  describe("reserveBalance method", () => {
    const richAddress = "Rich 💸";
    const poorAddress = "Poor 👨🏻‍🏫";

    before(async () => {
      await dbTestHelper.insertStubUser({
        user_address: richAddress,
        winston_credit_balance: "100000000000",
      });
      await dbTestHelper.insertStubUser({
        user_address: poorAddress,
        winston_credit_balance: "10",
      });
    });

    it("reserves the balance as expected when winston balance is available", async () => {
      const adjustments: UploadAdjustment[] = [
        {
          adjustmentAmount: new Winston(-500),
          name: "Best Adjustment Ever",
          operator: "add",
          operatorMagnitude: -500,
          description: "we rebate 500 winc on your upload :)",
          catalogId: "Stub Catalog ID",
        },
        {
          adjustmentAmount: new Winston(-2345678),
          name: "Another good Adjustment Ever",
          operator: "multiply",
          operatorMagnitude: 0.5,
          description: "we subsidize 50% of your upload 👍",
          catalogId: "Another stub catalog id",
        },
      ];

      await db.reserveBalance({
        userAddress: richAddress,
        reservedWincAmount: new FinalPrice(new Winston(500)),
        networkWincAmount: new NetworkPrice(new Winston(500)),
        dataItemId: stubTxId1,
        adjustments,
        userAddressType: "arweave",
      });

      const richUser = await db.getUser(richAddress);
      expect(+richUser.winstonCreditBalance).to.equal(99_999_999_500);

      const balanceReservationDbResult = await db[
        "writer"
      ]<BalanceReservationDBResult>(tableNames.balanceReservation).where({
        data_item_id: stubTxId1,
      });

      expect(balanceReservationDbResult.length).to.equal(1);
      expect(balanceReservationDbResult[0].user_address).to.equal(richAddress);
      expect(balanceReservationDbResult[0].reserved_winc_amount).to.equal(
        "500"
      );
      expect(balanceReservationDbResult[0].reserved_date).to.exist;
      expect(typeof balanceReservationDbResult[0].reservation_id).to.equal(
        "string"
      );
      expect(balanceReservationDbResult[0].data_item_id).to.equal(stubTxId1);

      const adjustmentDbResult = await db["writer"]<UploadAdjustmentDBInsert>(
        tableNames.uploadAdjustment
      ).where({
        reservation_id: balanceReservationDbResult[0].reservation_id,
      });
      expect(adjustmentDbResult.length).to.equal(2);

      expect(adjustmentDbResult[0].adjusted_winc_amount).to.equal("-500");
      expect(adjustmentDbResult[0].adjustment_index).to.equal(0);

      expect(adjustmentDbResult[1].adjusted_winc_amount).to.equal("-2345678");
      expect(adjustmentDbResult[1].adjustment_index).to.equal(1);

      const auditLogDbResult = await db["writer"]<AuditLogDBResult>(
        tableNames.auditLog
      ).where({
        change_id: stubTxId1,
      });

      expect(auditLogDbResult.length).to.equal(1);
      expect(auditLogDbResult[0].user_address).to.equal(richAddress);
      expect(auditLogDbResult[0].winston_credit_amount).to.equal("-500");
      expect(auditLogDbResult[0].change_id).to.equal(stubTxId1);
      expect(typeof auditLogDbResult[0].audit_id).to.equal("number");
      expect(auditLogDbResult[0].change_reason).to.equal("upload");
    });

    it("throws an error as expected when winston balance is not available", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.reserveBalance({
          userAddress: poorAddress,
          reservedWincAmount: new FinalPrice(new Winston(200)),
          networkWincAmount: new NetworkPrice(new Winston(200)),
          adjustments: [],
          dataItemId: stubTxId1,
          userAddressType: "arweave",
        }),
        errorType: "InsufficientBalance",
        errorMessage: `Insufficient balance for '${poorAddress}'`,
      });
      const poorUser = await db.getUser(poorAddress);

      expect(+poorUser.winstonCreditBalance).to.equal(10);
    });

    it("throws a warning as expected when user cannot be found", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.reserveBalance({
          userAddress: "Non Existent Address",
          reservedWincAmount: new FinalPrice(new Winston(200)),
          networkWincAmount: new NetworkPrice(new Winston(200)),
          adjustments: [],
          dataItemId: stubTxId1,
          userAddressType: "arweave",
        }),
        errorType: "UserNotFoundWarning",
        errorMessage:
          "No user found in database with address 'Non Existent Address'",
      });
    });
  });

  describe("refundBalance method", () => {
    const happyAddress = "Happy 😁";

    before(async () => {
      await dbTestHelper.insertStubUser({
        user_address: happyAddress,
        winston_credit_balance: "2000",
      });
    });

    it("refunds the balance as expected", async () => {
      await db.refundBalance(happyAddress, new Winston(100_000), stubTxId1);

      const happyUser = await db.getUser(happyAddress);

      expect(+happyUser.winstonCreditBalance).to.equal(102_000);
    });

    it("throws a warning as expected when user cannot be found", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.refundBalance(
          "Non Existent Address",
          new Winston(1337),
          stubTxId1
        ),
        errorType: "UserNotFoundWarning",
        errorMessage:
          "No user found in database with address 'Non Existent Address'",
      });
    });
  });

  describe("getSingleUsePromoCodeAdjustments", () => {
    it("returns the expected adjustment for a user and 20% off promo code", async () => {
      const userAddress = "userAddress";

      const adjustmentDbResult = await db.getSingleUsePromoCodeAdjustments(
        [postgresTestPromoCode],
        userAddress
      );
      expect(adjustmentDbResult.length).to.equal(1);

      const {
        catalogId,
        codeValue,
        exclusivity,
        name,
        operator,
        operatorMagnitude,
        priority,
        startDate,
        description,
        endDate,
      } = adjustmentDbResult[0];

      expect(catalogId).to.equal(postgresTestPromoCodeCatalogId);
      expect(codeValue).to.be.equal(postgresTestPromoCode);
      expect(exclusivity).to.be.equal("exclusive");
      expect(name).to.be.equal("Postgres Test Promo Code");
      expect(operator).to.be.equal("multiply");
      expect(operatorMagnitude).to.be.equal(0.8);
      expect(priority).to.be.equal(500);
      expect(startDate).to.be.a("date");
      expect(description).to.be.equal("");
      expect(endDate).to.be.null;
    });

    describe("test pilot referral code", () => {
      const pilotReferralPromoCode = "pilotReferralPromoCode";
      const pilotReferralPromoCodeCatalogId = "pilotReferralPromoCodeCatalogId";

      before(async () => {
        await db["writer"]<SingleUseCodePaymentCatalogDBResult>(
          tableNames.singleUseCodePaymentAdjustmentCatalog
        ).insert({
          code_value: pilotReferralPromoCode,
          adjustment_exclusivity: "exclusive",
          adjustment_name: "Pilot Referral Promo Code",
          catalog_id: pilotReferralPromoCodeCatalogId,
          target_user_group: "new",
          max_uses: 10,
          minimum_payment_amount: 5000,
          operator: "add",
          operator_magnitude: "-500",
          adjustment_start_date: "2023-09-20T16:47:37.660Z", // in the past
        });
      });

      it("returns the expected adjustment when un-used", async () => {
        const userAddress = "userAddress";

        const adjustmentDbResult = await db.getSingleUsePromoCodeAdjustments(
          [pilotReferralPromoCode],
          userAddress
        );
        expect(adjustmentDbResult.length).to.equal(1);

        const {
          catalogId,
          codeValue,
          exclusivity,
          name,
          operator,
          operatorMagnitude,
          priority,
          startDate,
          description,
          endDate,
          maxUses,
          minimumPaymentAmount,
          targetUserGroup,
        } = adjustmentDbResult[0];

        expect(catalogId).to.equal(pilotReferralPromoCodeCatalogId);
        expect(codeValue).to.be.equal(pilotReferralPromoCode);
        expect(exclusivity).to.be.equal("exclusive");
        expect(name).to.be.equal("Pilot Referral Promo Code");
        expect(operator).to.be.equal("add");
        expect(operatorMagnitude).to.be.equal(-500);
        expect(maxUses).to.be.equal(10);
        expect(minimumPaymentAmount).to.be.equal(5000);
        expect(targetUserGroup).to.be.equal("new");
        expect(priority).to.be.equal(500);
        expect(startDate).to.be.a("date");
        expect(description).to.be.equal("");
        expect(endDate).to.be.null;
      });

      it("errors as expected when used beyond max uses", async () => {
        for (let i = 0; i < 10; i++) {
          // Insert 10 stub payment adjustments with catalog id
          await dbTestHelper.insertStubPaymentAdjustment({
            catalog_id: pilotReferralPromoCodeCatalogId,
          });
        }

        await expectAsyncErrorThrow({
          promiseToError: db.getSingleUsePromoCodeAdjustments(
            [pilotReferralPromoCode],
            "userAddress"
          ),
          errorMessage: `The promo code '${pilotReferralPromoCode}' has already been used the maximum number of times (10)`,
          errorType: "PromoCodeExceedsMaxUses",
        });
      });
    });

    describe("when promo code has been used", () => {
      const usedPromoCodeUserAddress = "usedPromoCodeUserAddress";
      const usedPromoCodeTopUpQuoteId = "usedPromoCodeTopUpQuoteId";

      before(async () => {
        // Presence of Payment Receipt and Payment Adjustment indicates that the promo code has been used
        await dbTestHelper.insertStubPaymentReceipt({
          destination_address: usedPromoCodeUserAddress,
          top_up_quote_id: usedPromoCodeTopUpQuoteId,
        });
        await dbTestHelper.insertStubPaymentAdjustment({
          catalog_id: postgresTestPromoCodeCatalogId,
          top_up_quote_id: usedPromoCodeTopUpQuoteId,
          user_address: usedPromoCodeUserAddress,
        });
      });

      it("throws an error for a user when already used 20% off promo code", async () => {
        await expectAsyncErrorThrow({
          promiseToError: db.getSingleUsePromoCodeAdjustments(
            [postgresTestPromoCode],
            usedPromoCodeUserAddress
          ),
          errorMessage: `The user 'usedPromoCodeUserAddress' is ineligible for the promo code '${postgresTestPromoCode}'`,
          errorType: "UserIneligibleForPromoCode",
        });
      });
    });
  });
});
