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
import { mARIOToken } from "@ar.io/sdk";
import { expect } from "chai";

import { tableNames } from "../src/database/dbConstants";
import {
  ArNSPurchase,
  ArNSPurchaseDBResult,
  ArNSPurchaseQuoteDBResult,
  AuditLogDBResult,
  BalanceReservationDBResult,
  ChargebackReceiptDBResult,
  DelegatedPaymentApprovalDBResult,
  FailedArNSPurchaseDBResult,
  InactiveDelegatedPaymentApprovalDBResult,
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
import { W, Winston } from "../src/types/winston";
import { sleep } from "../src/utils/common";
import {
  DbTestHelper,
  randomCharString,
  stubArweaveUserAddress,
} from "./dbTestHelper";
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
      expect(userBalance.winc.toString()).to.equal("500");
    });

    const userToApproveAddress = "userToApproveAddress";
    const userToReceiveApprovalFromAddress = "userToReceiveApprovalFromAddress";

    it("gets any given and received approvals and shows the effective balance", async () => {
      // Approve userToApproveAddress to spend 100 winc from userWithBalanceAddress, bringing effective balance and winc to 400
      await db.createDelegatedPaymentApproval({
        approvalDataItemId: "approvalDataItemId 777",
        approvedAddress: userToApproveAddress,
        approvedWincAmount: new Winston("100"),
        payingAddress: userWithBalanceAddress,
      });

      await dbTestHelper.insertStubUser({
        user_address: userToReceiveApprovalFromAddress,
        winston_credit_balance: "500",
      });

      // Receive approval from userWithBalanceAddress to spend 250 winc, bringing effective balance to 650
      await db.createDelegatedPaymentApproval({
        approvalDataItemId: "approvalDataItemId 888",
        approvedAddress: userWithBalanceAddress,
        approvedWincAmount: new Winston("250"),
        payingAddress: userToReceiveApprovalFromAddress,
      });

      const {
        winc,
        controlledWinc,
        effectiveBalance,
        givenApprovals,
        receivedApprovals,
      } = await db.getBalance(userWithBalanceAddress);

      expect(controlledWinc.toString()).to.equal("500");
      expect(winc.toString()).to.equal("400");
      expect(effectiveBalance.toString()).to.equal("650");
      expect(givenApprovals.length).to.equal(1);
      expect(receivedApprovals.length).to.equal(1);
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
        signerAddress: richAddress,
        reservedWincAmount: new FinalPrice(new Winston(500)),
        networkWincAmount: new NetworkPrice(new Winston(500)),
        dataItemId: stubTxId1,
        adjustments,
        signerAddressType: "arweave",
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

    it("reserves the balance as expected to a non-existing user when the reservation is free", async () => {
      await db.reserveBalance({
        signerAddress: "Non Existent Address",
        reservedWincAmount: new FinalPrice(new Winston(0)),
        networkWincAmount: new NetworkPrice(new Winston(0)),
        dataItemId: "Unique Data Item ID Non Existent User Free Upload",
        adjustments: [],
        signerAddressType: "arweave",
      });

      const balanceReservationDbResult = await db[
        "writer"
      ]<BalanceReservationDBResult>(tableNames.balanceReservation).where({
        data_item_id: stubTxId1,
      });

      expect(balanceReservationDbResult.length).to.equal(1);
    });

    it("reserves the balance as expected when the first payer in the provided paid-by list covers the whole amount exactly", async () => {
      const payingAddress = "Stub Paying Address -- Used Approval Test";
      const signerAddress = "Signer Address -- Used Approval Test";

      await dbTestHelper.insertStubUser({
        user_address: payingAddress,
        winston_credit_balance: "500",
      });
      await dbTestHelper.createStubDelegatedPaymentApproval({
        paying_address: payingAddress,
        approved_address: signerAddress,
        approved_winc_amount: "500",
        createPayer: false,
      });

      const dataItemId = "Unique Data Item ID -- Used Approval Test";
      await db.reserveBalance({
        signerAddress,
        reservedWincAmount: new FinalPrice(new Winston(500)),
        networkWincAmount: new NetworkPrice(new Winston(500)),
        dataItemId,
        adjustments: [],
        signerAddressType: "arweave",
        paidBy: [payingAddress],
      });

      const balanceReservationDbResult = (
        await dbTestHelper
          .knex<BalanceReservationDBResult>(tableNames.balanceReservation)
          .where({
            data_item_id: dataItemId,
          })
      )[0];
      expect(balanceReservationDbResult.reserved_winc_amount).to.equal("500");
      expect(balanceReservationDbResult.user_address).to.equal(signerAddress);
      expect(balanceReservationDbResult.overflow_spend).to.deep.equal([
        {
          paying_address: payingAddress,
          winc_amount: "500",
        },
      ]);

      const inactiveApprovals = await dbTestHelper
        .knex<InactiveDelegatedPaymentApprovalDBResult>(
          tableNames.inactiveDelegatedPaymentApproval
        )
        .where({
          paying_address: payingAddress,
        });
      expect(inactiveApprovals.length).to.equal(1);
      expect(inactiveApprovals[0].inactive_reason).to.equal("used");
      expect(inactiveApprovals[0].used_winc_amount).to.equal("500");
      expect(inactiveApprovals[0].approved_winc_amount).to.equal("500");
    });

    it("errors when the signer created approvals for all their balance", async () => {
      const signerAddress =
        "Signer Address -- Used Approval Error When Given Other Approvals Test";

      await dbTestHelper.insertStubUser({
        user_address: signerAddress,
        winston_credit_balance: "500",
      });
      await dbTestHelper.db.createDelegatedPaymentApproval({
        payingAddress: signerAddress,
        approvedAddress: "Stub Approved Address -- Used Approval Test",
        approvedWincAmount: W("250"),
        approvalDataItemId: randomCharString(),
      });
      await dbTestHelper.db.createDelegatedPaymentApproval({
        payingAddress: signerAddress,
        approvedAddress: "Stub Approved Address 2 -- Used Approval Test",
        approvedWincAmount: W("250"),
        approvalDataItemId: randomCharString(),
      });

      await expectAsyncErrorThrow({
        promiseToError: db.reserveBalance({
          signerAddress,
          reservedWincAmount: new FinalPrice(new Winston(10)),
          networkWincAmount: new NetworkPrice(new Winston(10)),
          dataItemId: "Unique Data Item ID -- Used Approval Test",
          adjustments: [],
          signerAddressType: "arweave",
          paidBy: [],
        }),
        errorType: "InsufficientBalance",
        errorMessage: `Insufficient balance for '${signerAddress}'`,
      });
    });

    it("reserves the balance as expected when the first payer in the provided paid-by list covers the whole amount and the approval has winc amount leftover", async () => {
      const payingAddress = "Paying Address -- Leftover Approval Test";
      const signerAddress = "Signer Address -- Leftover Approval Test";
      const approvalDataItemId =
        "Unique Data Item ID -- Leftover Approval Test";

      await dbTestHelper.createStubDelegatedPaymentApproval({
        paying_address: payingAddress,
        approved_address: signerAddress,
        approved_winc_amount: "500",
        approval_data_item_id: approvalDataItemId,
      });

      await db.reserveBalance({
        signerAddress,
        reservedWincAmount: new FinalPrice(new Winston(100)),
        networkWincAmount: new NetworkPrice(new Winston(100)),
        dataItemId: approvalDataItemId,
        adjustments: [],
        signerAddressType: "arweave",
        paidBy: [payingAddress],
      });

      const balanceReservationDbResult = (
        await dbTestHelper
          .knex<BalanceReservationDBResult>(tableNames.balanceReservation)
          .where({
            data_item_id: approvalDataItemId,
          })
      )[0];
      expect(balanceReservationDbResult.reserved_winc_amount).to.equal("100");
      expect(balanceReservationDbResult.user_address).to.equal(signerAddress);
      expect(balanceReservationDbResult.overflow_spend).to.deep.equal([
        {
          paying_address: payingAddress,
          winc_amount: "100",
        },
      ]);

      const payerUser = await db.getUser(payingAddress);
      expect(+payerUser.winstonCreditBalance).to.equal(1000);

      const delegatedApprovals = await dbTestHelper
        .knex<DelegatedPaymentApprovalDBResult>(
          tableNames.delegatedPaymentApproval
        )
        .where({
          approval_data_item_id: approvalDataItemId,
        });
      expect(delegatedApprovals.length).to.equal(1);
      expect(delegatedApprovals[0].approved_winc_amount).to.equal("500");
      expect(delegatedApprovals[0].used_winc_amount).to.equal("100");
    });

    it("reserves the balance as expected when the first payer in the provided paid-by list covers some of the amount and the second and third payers cover the overflow spend", async () => {
      const signerAddress = "Signer Address -- Overflow Test";
      const payingAddress1 = "Paying Address 1 -- Overflow Test";
      const payingAddress2 = "Paying Address 2 -- Overflow Test";
      const payingAddress3 = "Paying Address 3 -- Overflow Test";
      const approval1DataItemId = "Unique Data Item ID 1 -- Overflow Test";
      const approval2DataItemId = "Unique Data Item ID 2 -- Overflow Test";
      const approval3DataItemId = "Unique Data Item ID 3 -- Overflow Test";

      await dbTestHelper.createStubDelegatedPaymentApproval({
        paying_address: payingAddress1,
        approved_winc_amount: "200",
        approval_data_item_id: approval1DataItemId,
        approved_address: signerAddress,
      });
      await dbTestHelper.createStubDelegatedPaymentApproval({
        paying_address: payingAddress2,
        approved_winc_amount: "100",
        approval_data_item_id: approval2DataItemId,
        approved_address: signerAddress,
      });
      await dbTestHelper.createStubDelegatedPaymentApproval({
        paying_address: payingAddress3,
        approved_winc_amount: "100",
        approval_data_item_id: approval3DataItemId,
        approved_address: signerAddress,
      });

      await db.reserveBalance({
        signerAddress,
        reservedWincAmount: new FinalPrice(new Winston(350)),
        networkWincAmount: new NetworkPrice(new Winston(350)),
        dataItemId: approval1DataItemId,
        adjustments: [],
        signerAddressType: "arweave",
        paidBy: [payingAddress1, payingAddress2, payingAddress3],
      });

      const balanceReservationDbResult = (
        await dbTestHelper
          .knex<BalanceReservationDBResult>(tableNames.balanceReservation)
          .where({
            data_item_id: approval1DataItemId,
          })
      )[0];
      expect(balanceReservationDbResult.reserved_winc_amount).to.equal("350");
      expect(balanceReservationDbResult.user_address).to.equal(signerAddress);
      expect(balanceReservationDbResult.overflow_spend).to.deep.equal([
        {
          paying_address: payingAddress1,
          winc_amount: "200",
        },
        {
          paying_address: payingAddress2,
          winc_amount: "100",
        },
        {
          paying_address: payingAddress3,
          winc_amount: "50",
        },
      ]);

      const inactiveApproval1 = (
        await dbTestHelper
          .knex<InactiveDelegatedPaymentApprovalDBResult>(
            tableNames.inactiveDelegatedPaymentApproval
          )
          .where({
            approval_data_item_id: approval1DataItemId,
          })
      )[0];
      expect(inactiveApproval1.inactive_reason).to.equal("used");
      expect(inactiveApproval1.used_winc_amount).to.equal("200");

      const inactiveApproval2 = (
        await dbTestHelper
          .knex<InactiveDelegatedPaymentApprovalDBResult>(
            tableNames.inactiveDelegatedPaymentApproval
          )
          .where({
            approval_data_item_id: approval2DataItemId,
          })
      )[0];
      expect(inactiveApproval2.inactive_reason).to.equal("used");
      expect(inactiveApproval2.used_winc_amount).to.equal("100");

      const delegatedApproval3 = (
        await dbTestHelper
          .knex<DelegatedPaymentApprovalDBResult>(
            tableNames.delegatedPaymentApproval
          )
          .where({
            approval_data_item_id: approval3DataItemId,
          })
      )[0];
      expect(delegatedApproval3.approved_winc_amount).to.equal("100");
      expect(delegatedApproval3.used_winc_amount).to.equal("50");
    });

    it("reserves the balance as expected when the first payer in the provided paid-by list covers some of the amount and the signer's balance covers the overflow spend", async () => {
      const signerAddress = "Signer Address -- Overflow to Signer Test";
      const payingAddress1 = "Paying Address 1 -- Overflow to Signer Test";
      const approval1DataItemId =
        "Unique Data Item ID 1 -- Overflow to Signer Test";

      await dbTestHelper.insertStubUser({
        user_address: signerAddress,
        winston_credit_balance: "1000",
      });

      await dbTestHelper.createStubDelegatedPaymentApproval({
        paying_address: payingAddress1,
        approved_winc_amount: "200",
        approval_data_item_id: approval1DataItemId,
        approved_address: signerAddress,
      });

      await db.reserveBalance({
        signerAddress,
        reservedWincAmount: new FinalPrice(new Winston(500)),
        networkWincAmount: new NetworkPrice(new Winston(500)),
        dataItemId: approval1DataItemId,
        adjustments: [],
        signerAddressType: "arweave",
        paidBy: [payingAddress1],
      });

      const signerUser = await db.getUser(signerAddress);
      expect(+signerUser.winstonCreditBalance).to.equal(700);

      const balanceReservationDbResult = (
        await dbTestHelper
          .knex<BalanceReservationDBResult>(tableNames.balanceReservation)
          .where({
            data_item_id: approval1DataItemId,
          })
      )[0];
      expect(balanceReservationDbResult.reserved_winc_amount).to.equal("500");
      expect(balanceReservationDbResult.user_address).to.equal(signerAddress);
      expect(balanceReservationDbResult.overflow_spend).to.deep.equal([
        {
          paying_address: payingAddress1,
          winc_amount: "200",
        },
        {
          paying_address: signerAddress,
          winc_amount: "300",
        },
      ]);
    });

    it("throws an error as expected when the first payer in the provided paid-by list covers some of the amount but neither the second payer or the signer can cover the overflow spend", async () => {
      const signerAddress = "Signer Address -- Overflow Failure Test";
      const payingAddress1 = "Paying Address 1 -- Overflow Failure Test";
      const payingAddress2 = "Paying Address 2 -- Overflow Failure Test";
      const approval1DataItemId =
        "Unique Data Item ID 1 -- Overflow Failure Test";
      const approval2DataItemId =
        "Unique Data Item ID 2 -- Overflow Failure Test";

      await dbTestHelper.createStubDelegatedPaymentApproval({
        approved_winc_amount: "200",
        approval_data_item_id: approval1DataItemId,
        approved_address: signerAddress,
        paying_address: payingAddress1,
      });
      await dbTestHelper.createStubDelegatedPaymentApproval({
        approved_winc_amount: "100",
        approval_data_item_id: approval2DataItemId,
        approved_address: signerAddress,
        paying_address: payingAddress2,
      });

      await expectAsyncErrorThrow({
        promiseToError: db.reserveBalance({
          signerAddress,
          reservedWincAmount: new FinalPrice(new Winston(350)),
          networkWincAmount: new NetworkPrice(new Winston(350)),
          dataItemId: approval1DataItemId,
          adjustments: [],
          signerAddressType: "arweave",
          paidBy: [payingAddress1, payingAddress2],
        }),
        errorType: "InsufficientBalance",
        errorMessage: `Insufficient balance for '${signerAddress}'`,
      });

      const payerUser1 = await db.getUser(payingAddress1);
      expect(+payerUser1.winstonCreditBalance).to.equal(1000);

      const payerUser2 = await db.getUser(payingAddress2);
      expect(+payerUser2.winstonCreditBalance).to.equal(1000);
    });

    it("throws an error as expected when winston balance is not available", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.reserveBalance({
          signerAddress: poorAddress,
          reservedWincAmount: new FinalPrice(new Winston(200)),
          networkWincAmount: new NetworkPrice(new Winston(200)),
          adjustments: [],
          dataItemId: stubTxId1,
          signerAddressType: "arweave",
        }),
        errorType: "InsufficientBalance",
        errorMessage: `Insufficient balance for '${poorAddress}'`,
      });
      const poorUser = await db.getUser(poorAddress);

      expect(+poorUser.winstonCreditBalance).to.equal(10);
    });

    it("throws a warning as expected when user cannot be found for reserved balance", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.reserveBalance({
          signerAddress: "Non Existent Address",
          reservedWincAmount: new FinalPrice(new Winston(200)),
          networkWincAmount: new NetworkPrice(new Winston(200)),
          adjustments: [],
          dataItemId: stubTxId1,
          signerAddressType: "arweave",
        }),
        errorType: "InsufficientBalance",
        errorMessage: "Insufficient balance for 'Non Existent Address'",
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
      const uniqueDataItemId = "Unique Data Item ID -- Happy Refund Test";
      await db.refundBalance(
        happyAddress,
        new Winston(100_000),
        uniqueDataItemId
      );

      const happyUser = await db.getUser(happyAddress);

      expect(+happyUser.winstonCreditBalance).to.equal(102_000);
    });

    it("throws a warning as expected when user cannot be found", async () => {
      const uniqueDataItemId = "Unique Data Item ID -- Not Happy Refund Test";
      await expectAsyncErrorThrow({
        promiseToError: db.refundBalance(
          "Non Existent Address",
          new Winston(1337),
          uniqueDataItemId
        ),
        errorType: "UserNotFoundWarning",
        errorMessage:
          "No user found in database with address 'Non Existent Address'",
      });
    });

    it("refunds the balance as expected for overflow spend on approved balances", async () => {
      const payingAddress1 = "Paying Address -- Overflow Refund Test";
      const payingAddress2 = "Paying Address 2 -- Overflow Refund Test";

      const signerAddress = "Signer Address -- Overflow Refund Test";

      await dbTestHelper.createStubDelegatedPaymentApproval({
        paying_address: payingAddress1,
        approved_address: signerAddress,
        approved_winc_amount: "500",
      });
      await dbTestHelper.createStubDelegatedPaymentApproval({
        paying_address: payingAddress2,
        approved_address: signerAddress,
        approved_winc_amount: "500",
      });
      await dbTestHelper.insertStubUser({
        user_address: signerAddress,
        winston_credit_balance: "500",
      });
      const dataItemId = "Unique Data Item ID -- Overflow Refund Test";

      await db.reserveBalance({
        signerAddress,
        reservedWincAmount: new FinalPrice(new Winston(1500)),
        networkWincAmount: new NetworkPrice(new Winston(1500)),
        dataItemId,
        adjustments: [],
        signerAddressType: "arweave",
        paidBy: [payingAddress1, payingAddress2, signerAddress],
      });

      const signerBalanceAfterReservation = (
        await db.getUser(signerAddress)
      ).winstonCreditBalance.toString();
      expect(signerBalanceAfterReservation).to.equal("0");

      await db.refundBalance(signerAddress, new Winston(1000), dataItemId);

      // Balances are restored
      const signerBalanceAfterRefund = (
        await db.getUser(signerAddress)
      ).winstonCreditBalance.toString();
      expect(signerBalanceAfterRefund).to.equal("500");

      // Approval used winc amounts are restored
      const approval1UsedWincAmount = (
        await dbTestHelper
          .knex<DelegatedPaymentApprovalDBResult>(
            tableNames.delegatedPaymentApproval
          )
          .where({
            approved_address: signerAddress,
            paying_address: payingAddress1,
          })
      )[0].used_winc_amount;
      expect(approval1UsedWincAmount).to.equal("0");

      const approval2UsedWincAmount = (
        await dbTestHelper
          .knex<DelegatedPaymentApprovalDBResult>(
            tableNames.delegatedPaymentApproval
          )
          .where({
            approved_address: signerAddress,
            paying_address: payingAddress2,
          })
      )[0].used_winc_amount;
      expect(approval2UsedWincAmount).to.equal("0");
    });

    it("refunds balance to the payingAddress when an approval has been revoked since the reservation", async () => {
      const payingAddress = "Paying Address -- Revoked Refund to Payer Test";
      const signerAddress = "Signer Address -- Revoked Refund to Payer Test";
      const approvalDataItemIdRevoked =
        "Revoked Unique Data Item ID -- Revoked Refund to Payer Test";

      await dbTestHelper.insertStubUser({
        user_address: payingAddress,
        winston_credit_balance: "1000",
      });
      await dbTestHelper.db.createDelegatedPaymentApproval({
        approvalDataItemId: approvalDataItemIdRevoked,
        payingAddress,
        approvedAddress: signerAddress,
        approvedWincAmount: W("100"),
      });

      expect(
        (await dbTestHelper.db.getBalance(payingAddress)).winc.toString()
      ).to.equal("900");

      await db.reserveBalance({
        signerAddress,
        reservedWincAmount: new FinalPrice(new Winston(50)),
        networkWincAmount: new NetworkPrice(new Winston(50)),
        dataItemId: approvalDataItemIdRevoked,
        adjustments: [],
        signerAddressType: "arweave",
        paidBy: [payingAddress],
      });
      await db.revokeDelegatedPaymentApprovals({
        approvedAddress: signerAddress,
        payingAddress,
        revokeDataItemId: randomCharString(),
      });

      // payingAddress should have un-used winc balance restored on revoke
      expect(
        (await dbTestHelper.db.getBalance(payingAddress)).winc.toString()
      ).to.equal("950");

      await db.refundBalance(
        signerAddress,
        new Winston(50),
        approvalDataItemIdRevoked
      );

      // payingAddress should have the refunded winc amount restored when approval was revoked
      expect(
        (await dbTestHelper.db.getBalance(payingAddress)).winc.toString()
      ).to.equal("1000");
    });

    it("refunds balance to the payingAddress when an approval has been expired since the reservation", async () => {
      const payingAddress = "Paying Address -- Refund to Payer Test";
      const signerAddress = "Signer Address -- Refund to Payer Test";
      const approvalDataItemIdRevoked =
        "Revoked Unique Data Item ID -- Refund to Payer Test";

      await dbTestHelper.insertStubUser({
        user_address: payingAddress,
        winston_credit_balance: "1000",
      });
      await dbTestHelper.db.createDelegatedPaymentApproval({
        approvalDataItemId: approvalDataItemIdRevoked,
        payingAddress,
        approvedAddress: signerAddress,
        approvedWincAmount: W("100"),
        expiresInSeconds: 2,
      });

      expect(
        (await dbTestHelper.db.getBalance(payingAddress)).winc.toString()
      ).to.equal("900");

      await db.reserveBalance({
        signerAddress,
        reservedWincAmount: new FinalPrice(new Winston(50)),
        networkWincAmount: new NetworkPrice(new Winston(50)),
        dataItemId: approvalDataItemIdRevoked,
        adjustments: [],
        signerAddressType: "arweave",
        paidBy: [payingAddress],
      });
      await sleep(2000);

      // payingAddress should have un-used winc balance restored on expiration
      expect(
        (await dbTestHelper.db.getBalance(payingAddress)).winc.toString()
      ).to.equal("950");

      await db.refundBalance(
        signerAddress,
        new Winston(50),
        approvalDataItemIdRevoked
      );

      // payingAddress should have the refunded winc amount restored when approval was expired
      expect(
        (await dbTestHelper.db.getBalance(payingAddress)).winc.toString()
      ).to.equal("1000");
    });

    it("refunds balance to the payingAddress when an approval has become inactive and fully used and then revoked since the reservation", async () => {
      const payingAddress =
        "Paying Address -- Used then Revoked Refund to Payer Test";
      const signerAddress =
        "Signer Address -- Used then Revoked Refund to Payer Test";
      const approvalDataItemIdRevoked =
        "Revoked Unique Data Item ID -- Used then Revoked Refund to Payer Test";

      await dbTestHelper.insertStubUser({
        user_address: payingAddress,
        winston_credit_balance: "1000",
      });
      await dbTestHelper.db.createDelegatedPaymentApproval({
        approvalDataItemId: approvalDataItemIdRevoked,
        payingAddress,
        approvedAddress: signerAddress,
        approvedWincAmount: W("100"),
      });
      expect(
        (await dbTestHelper.db.getBalance(payingAddress)).winc.toString()
      ).to.equal("900");

      await db.reserveBalance({
        signerAddress,
        reservedWincAmount: new FinalPrice(new Winston(100)),
        networkWincAmount: new NetworkPrice(new Winston(100)),
        dataItemId: approvalDataItemIdRevoked,
        adjustments: [],
        signerAddressType: "arweave",
        paidBy: [payingAddress],
      });

      const inactiveApprovals = await dbTestHelper
        .knex<InactiveDelegatedPaymentApprovalDBResult>(
          tableNames.inactiveDelegatedPaymentApproval
        )
        .where({
          approval_data_item_id: approvalDataItemIdRevoked,
        });
      expect(inactiveApprovals).to.have.length(1);
      expect(inactiveApprovals[0].inactive_reason).to.equal("used");

      const revokeDataItemId = randomCharString();

      await db.revokeDelegatedPaymentApprovals({
        approvedAddress: signerAddress,
        payingAddress,
        revokeDataItemId,
      });

      const inactiveApprovalsAfterRevoke = await dbTestHelper
        .knex<InactiveDelegatedPaymentApprovalDBResult>(
          tableNames.inactiveDelegatedPaymentApproval
        )
        .where({
          approval_data_item_id: approvalDataItemIdRevoked,
        });
      expect(inactiveApprovalsAfterRevoke).to.have.length(1);
      expect(inactiveApprovalsAfterRevoke[0].inactive_reason).to.equal(
        "revoked"
      );
      expect(inactiveApprovalsAfterRevoke[0].revoke_data_item_id).to.equal(
        revokeDataItemId
      );

      await db.refundBalance(
        signerAddress,
        new Winston(100),
        approvalDataItemIdRevoked
      );

      // payingAddress should have all winc balance restored on used but then revoked and then refunded approvals
      expect(
        (await dbTestHelper.db.getBalance(payingAddress)).winc.toString()
      ).to.equal("1000");
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

  describe("createDelegatedPaymentApproval method", () => {
    it("creates a delegated payment approval as expected", async () => {
      const payingAddress = "Paying Address -- Create Approval Test";
      const approvedAddress = "Approved Address -- Create Approval Test";
      const approvalDataItemId = "Unique Data Item ID -- Create Approval Test";
      const approvedWincAmount = W(500);

      await dbTestHelper.insertStubUser({
        user_address: payingAddress,
        winston_credit_balance: "1000",
      });

      await db.createDelegatedPaymentApproval({
        approvedWincAmount,
        approvalDataItemId,
        approvedAddress,
        payingAddress,
      });

      const delegatedApprovals = await dbTestHelper
        .knex<DelegatedPaymentApprovalDBResult>(
          tableNames.delegatedPaymentApproval
        )
        .where({
          approval_data_item_id: approvalDataItemId,
        });

      expect(delegatedApprovals.length).to.equal(1);
      expect(delegatedApprovals[0].approved_winc_amount).to.equal("500");
      expect(delegatedApprovals[0].approved_address).to.equal(approvedAddress);
      expect(delegatedApprovals[0].paying_address).to.equal(payingAddress);
      expect(delegatedApprovals[0].approval_data_item_id).to.equal(
        approvalDataItemId
      );
      expect(delegatedApprovals[0].creation_date).to.exist;
      expect(delegatedApprovals[0].used_winc_amount).to.equal("0");
      expect(delegatedApprovals[0].expiration_date).to.equal(null);

      const user = await db.getUser(payingAddress);
      expect(user.winstonCreditBalance.toString()).to.equal("500");
    });

    it("creating multiple payment approvals will aggregate one's effective balance", async () => {
      const payingAddress = "Paying Address -- Create Approval Test 2";
      const approvedAddress = "Approved Address -- Create Approval Test 2";
      const approvalDataItemId1 =
        "Unique Data Item ID -- Create Approval Test 2";
      const approvalDataItemId2 =
        "Unique Data Item ID 2 -- Create Approval Test 2";

      await dbTestHelper.insertStubUser({
        user_address: payingAddress,
        winston_credit_balance: "1000",
      });

      await db.createDelegatedPaymentApproval({
        approvedWincAmount: W(50),
        approvalDataItemId: approvalDataItemId1,
        approvedAddress,
        payingAddress,
      });

      await db.createDelegatedPaymentApproval({
        approvedWincAmount: W(25),
        approvalDataItemId: approvalDataItemId2,
        approvedAddress,
        payingAddress,
      });

      const {
        winc,
        controlledWinc,
        effectiveBalance,
        givenApprovals,
        receivedApprovals,
      } = await db.getBalance(payingAddress);

      expect(controlledWinc.toString()).to.equal("1000");
      expect(winc.toString()).to.equal("925");
      expect(effectiveBalance.toString()).to.equal("925");
      expect(givenApprovals.length).to.equal(2);
      expect(receivedApprovals.length).to.equal(0);
    });

    it("errors as expected when payingAddress does not have enough balance to cover the approvedWincAmount", async () => {
      const payingAddress =
        "Paying Address -- Insufficient Balance For Create Approval Test";
      const approvedAddress =
        "Approved Address -- Insufficient Balance For Create Approval Test";
      const approvalDataItemId =
        "Unique Data Item ID -- Insufficient Balance For Create Approval Test";
      const approvedWincAmount = W(500);

      await dbTestHelper.insertStubUser({
        user_address: payingAddress,
        winston_credit_balance: "100",
      });

      await expectAsyncErrorThrow({
        promiseToError: db.createDelegatedPaymentApproval({
          approvedWincAmount,
          approvalDataItemId,
          approvedAddress,
          payingAddress,
        }),
        errorMessage: `Insufficient balance for '${payingAddress}'`,
        errorType: "InsufficientBalance",
      });

      const delegatedApprovals = await dbTestHelper
        .knex<DelegatedPaymentApprovalDBResult>(
          tableNames.delegatedPaymentApproval
        )
        .where({
          approval_data_item_id: approvalDataItemId,
        });

      expect(delegatedApprovals.length).to.equal(0);
    });

    it("errors as expected when a new approval is made with an approvalDataItemId that conflicts with an inactive approval", async () => {
      const payingAddress =
        "Paying Address -- Conflicting Approval Data Item ID Test";
      const approvedAddress =
        "Approved Address -- Conflicting Approval Data Item ID Test";
      const approvalDataItemId =
        "Unique Data Item ID -- Conflicting Approval Data Item ID Test";
      const approvedWincAmount = W(500);

      await dbTestHelper.createStubDelegatedPaymentApproval({
        paying_address: payingAddress,
        approved_address: approvedAddress,
        approval_data_item_id: approvalDataItemId,
      });
      await db.revokeDelegatedPaymentApprovals({
        payingAddress,
        approvedAddress,
        revokeDataItemId:
          "Unique Revoke Data Item ID -- Conflicting Approval Data Item ID Test",
      });

      await expectAsyncErrorThrow({
        promiseToError: db.createDelegatedPaymentApproval({
          approvedWincAmount,
          approvalDataItemId,
          approvedAddress,
          payingAddress,
        }),
        errorMessage: `Conflicting approval found for approval ID '${approvalDataItemId}'`,
        errorType: "ConflictingApprovalFound",
      });

      const delegatedApprovals = await dbTestHelper
        .knex<DelegatedPaymentApprovalDBResult>(
          tableNames.delegatedPaymentApproval
        )
        .where({
          approval_data_item_id: approvalDataItemId,
        });

      expect(delegatedApprovals.length).to.equal(0);
    });

    it("errors as expected when payingAddress does not have enough balance to cover the approvedWincAmount when the aggregated approved balances would exceed the user's raw spending power", async () => {
      const payingAddress =
        "Paying Address -- Insufficient Balance For Create Approval Spending Power Test 2";
      const approvedAddress =
        "Approved Address -- Insufficient Balance For Create Approval Spending Power Test 2";
      const approvedAddress2 =
        "Approved Address 2 -- Insufficient Balance For Create Approval Spending Power Test 2";

      const approvalDataItemId =
        "Unique Data Item ID -- Insufficient Balance For Create Approval Spending Power Test 2";
      const approvalDataItemId2 =
        "Unique Data Item ID 2 -- Insufficient Balance For Create Approval Spending Power Test 2";
      const approvalDataItemId3 =
        "Unique Data Item ID 3 -- Insufficient Balance For Create Approval Spending Power Test 2";

      const anotherPayingAddress =
        "Another Paying Address -- Insufficient Balance For Create Approval Spending Power Test 2";

      const approvedWincAmount = W(400);

      await dbTestHelper.insertStubUser({
        user_address: payingAddress,
        winston_credit_balance: "1000",
      });

      await db.createDelegatedPaymentApproval({
        approvedWincAmount,
        approvalDataItemId,
        approvedAddress,
        payingAddress,
      });

      await db.createDelegatedPaymentApproval({
        approvedWincAmount,
        approvalDataItemId: approvalDataItemId2,
        approvedAddress: approvedAddress2,
        payingAddress,
      });

      await dbTestHelper.insertStubUser({
        user_address: anotherPayingAddress,
        winston_credit_balance: "1000",
      });

      await db.createDelegatedPaymentApproval({
        approvedWincAmount,
        approvalDataItemId: approvalDataItemId3,
        approvedAddress: payingAddress,
        payingAddress: anotherPayingAddress,
      });

      // The aggregated approved balance would be 800, so adding another 400 approved balance exceeds the user's raw balance of 1000
      await expectAsyncErrorThrow({
        promiseToError: db.createDelegatedPaymentApproval({
          approvedWincAmount,
          approvalDataItemId: "Unique not conflicting approval id",
          approvedAddress: stubArweaveUserAddress,
          payingAddress,
        }),
        errorMessage: `Insufficient balance for '${payingAddress}'`,
        errorType: "InsufficientBalance",
      });

      const delegatedApprovals = await dbTestHelper
        .knex<DelegatedPaymentApprovalDBResult>(
          tableNames.delegatedPaymentApproval
        )
        .where({
          paying_address: payingAddress,
        });

      expect(delegatedApprovals.length).to.equal(2);

      const { winc, controlledWinc, effectiveBalance } = await db.getBalance(
        payingAddress
      );
      expect(controlledWinc.toString()).to.equal("1000");
      // The user's spending power on their account is 200 because the user has 2 approvals with 400 approved balance each
      expect(winc.toString()).to.equal("200");
      // The user's effective balance from all approvals is 600 because the user received 400 approved balance from another payer
      expect(effectiveBalance.toString()).to.equal("600");
    });
  });
  describe("revokeDelegatedPaymentApprovals method", () => {
    it("revokes all delegated payment approvals as expected", async () => {
      const payingAddress = "Paying Address -- Revoke Approval Test";
      const approvedAddress = "Approved Address -- Revoke Approval Test";
      const approvalDataItemId = "Unique Data Item ID -- Revoke Approval Test";
      const approvalDataItemId2 =
        "Unique Data Item ID 2 -- Revoke Approval Test";

      await dbTestHelper.insertStubUser({
        user_address: payingAddress,
        winston_credit_balance: "1000",
      });

      await db.createDelegatedPaymentApproval({
        approvedWincAmount: W(500),
        approvalDataItemId,
        approvedAddress,
        payingAddress,
      });
      await db.createDelegatedPaymentApproval({
        approvedWincAmount: W(250),
        approvalDataItemId: approvalDataItemId2,
        approvedAddress,
        payingAddress,
      });

      const effectiveBalanceBeforeRevoke = (await db.getBalance(payingAddress))
        .effectiveBalance;

      const revokeDataItemId =
        "Unique Revoke Data Item ID -- Revoke Approval Test";

      await db.revokeDelegatedPaymentApprovals({
        payingAddress,
        approvedAddress,
        revokeDataItemId,
      });

      const inactiveApprovals = await dbTestHelper
        .knex<InactiveDelegatedPaymentApprovalDBResult>(
          tableNames.inactiveDelegatedPaymentApproval
        )
        .where({
          approved_address: approvedAddress,
        });
      expect(inactiveApprovals.length).to.equal(2);
      expect(inactiveApprovals[0].inactive_reason).to.equal("revoked");
      expect(inactiveApprovals[0].revoke_data_item_id).to.equal(
        revokeDataItemId
      );

      const delegatedApprovals = await dbTestHelper
        .knex<DelegatedPaymentApprovalDBResult>(
          tableNames.delegatedPaymentApproval
        )
        .where({
          approval_data_item_id: approvalDataItemId,
        });

      expect(delegatedApprovals.length).to.equal(0);

      const effectiveBalanceAfterRevoke = (await db.getBalance(payingAddress))
        .effectiveBalance;

      expect(effectiveBalanceBeforeRevoke.toString()).to.equal("250");
      expect(effectiveBalanceAfterRevoke.toString()).to.equal("1000");

      const user = await db.getUser(payingAddress);
      expect(user.winstonCreditBalance.toString()).to.equal("1000");
    });

    it("errors as expected when no approvals are found for the given payingAddress and approvedAddress", async () => {
      const payingAddress = "Paying Address -- Revoke Approval Error Test 2";
      const approvedAddress =
        "Approved Address -- Revoke Approval Error Test 2";

      await expectAsyncErrorThrow({
        promiseToError: db.revokeDelegatedPaymentApprovals({
          payingAddress,
          approvedAddress,
          revokeDataItemId:
            "Unique Data Item ID -- Revoke Approval Error Test 2",
        }),
        errorMessage: `No valid approvals found for approved address '${approvedAddress}' and paying address '${payingAddress}'`,
        errorType: "NoApprovalsFound",
      });
    });
  });
  describe("getAllApprovalsForAddress method", () => {
    it("gets all approvals for a given address as expected", async () => {
      const payingAddress1 = "Paying Address 1 -- Get All Approvals Test";
      await dbTestHelper.insertStubUser({
        user_address: payingAddress1,
        winston_credit_balance: "1000",
      });
      const payingAddress2 = "Paying Address 2 -- Get All Approvals Test";
      await dbTestHelper.insertStubUser({
        user_address: payingAddress2,
        winston_credit_balance: "1000",
      });

      const approvedAddress1 = "Approved Address 1 -- Get All Approvals Test";
      const approvedAddress2 = "Approved Address 2 -- Get All Approvals Test";

      const userAddress = "User Address -- Get All Approvals Test";
      await dbTestHelper.insertStubUser({
        user_address: userAddress,
        winston_credit_balance: "1000",
      });

      const receivedApprovalWithClosestExpirationDate =
        "Unique Data Item ID -- Get All Approvals Test";
      const receivedApprovalWithAnExpirationDate =
        "Unique Data Item ID 2 -- Get All Approvals Test";
      const receivedApprovalWithNoExpiration =
        "Unique Data Item ID 3 -- Get All Approvals Test";
      const oldestReceivedApprovalWithNoExpiration =
        "Unique Data Item ID 4 -- Get All Approvals Test";

      await db.createDelegatedPaymentApproval({
        approvedWincAmount: W(100),
        approvalDataItemId: oldestReceivedApprovalWithNoExpiration,
        approvedAddress: userAddress,
        payingAddress: payingAddress1,
      });
      await db.createDelegatedPaymentApproval({
        approvedWincAmount: W(100),
        approvalDataItemId: receivedApprovalWithClosestExpirationDate,
        approvedAddress: userAddress,
        payingAddress: payingAddress1,
        expiresInSeconds: 100,
      });
      await db.createDelegatedPaymentApproval({
        approvedWincAmount: W(100),
        approvalDataItemId: receivedApprovalWithAnExpirationDate,
        approvedAddress: userAddress,
        payingAddress: payingAddress2,
        expiresInSeconds: 200000,
      });
      await db.createDelegatedPaymentApproval({
        approvedWincAmount: W(100),
        approvalDataItemId: receivedApprovalWithNoExpiration,
        approvedAddress: userAddress,
        payingAddress: payingAddress2,
      });

      const givenApprovalWithClosestExpirationDate =
        "Unique Data Item ID 5 -- Get All Approvals Test";
      const givenApprovalWithAnExpirationDate =
        "Unique Data Item ID 6 -- Get All Approvals Test";

      await db.createDelegatedPaymentApproval({
        approvedWincAmount: W(100),
        approvalDataItemId: givenApprovalWithClosestExpirationDate,
        approvedAddress: approvedAddress1,
        payingAddress: userAddress,
      });
      await db.createDelegatedPaymentApproval({
        approvedWincAmount: W(100),
        approvalDataItemId: givenApprovalWithAnExpirationDate,
        approvedAddress: approvedAddress2,
        payingAddress: userAddress,
      });

      const expiredGivenApproval =
        "Expired data item ID -- Get All Approvals Test";
      await dbTestHelper
        .knex<DelegatedPaymentApprovalDBResult>(
          tableNames.delegatedPaymentApproval
        )
        .insert({
          approval_data_item_id: expiredGivenApproval,
          approved_address: approvedAddress1,
          paying_address: userAddress,
          approved_winc_amount: "100",
          creation_date: new Date().toISOString(),
          expiration_date: new Date(Date.now() - 1000).toISOString(),
          used_winc_amount: "0",
        });

      const { givenApprovals, receivedApprovals } =
        await db.getAllApprovalsForUserAddress(userAddress);

      expect(givenApprovals.length).to.equal(2);

      expect(givenApprovals[0].approvalDataItemId).to.equal(
        givenApprovalWithClosestExpirationDate
      );
      expect(givenApprovals[1].approvalDataItemId).to.equal(
        givenApprovalWithAnExpirationDate
      );

      expect(receivedApprovals.length).to.equal(4);

      expect(receivedApprovals[0].approvalDataItemId).to.equal(
        receivedApprovalWithClosestExpirationDate
      );
      expect(receivedApprovals[1].approvalDataItemId).to.equal(
        receivedApprovalWithAnExpirationDate
      );
      expect(receivedApprovals[2].approvalDataItemId).to.equal(
        oldestReceivedApprovalWithNoExpiration
      );
      expect(receivedApprovals[3].approvalDataItemId).to.equal(
        receivedApprovalWithNoExpiration
      );

      const inactiveApprovals = await dbTestHelper
        .knex<InactiveDelegatedPaymentApprovalDBResult>(
          tableNames.inactiveDelegatedPaymentApproval
        )
        .where({
          paying_address: userAddress,
        });

      expect(inactiveApprovals.length).to.equal(1);
      expect(inactiveApprovals[0].approval_data_item_id).to.equal(
        expiredGivenApproval
      );
      expect(inactiveApprovals[0].inactive_reason).to.equal("expired");

      // Balance from the expired approval is restored
      const user = await db.getUser(userAddress);
      expect(user.winstonCreditBalance.toString()).to.equal("900");
    });
  });

  describe("getApprovalsFromPayerForAddress method", () => {
    it("gets all approvals from a payer to a specific address as expected", async () => {
      const payingAddress = "Paying Address -- Get Approvals From Payer Test";
      const approvedAddress =
        "Approved Address -- Get Approvals From Payer Test";
      const approvalDataItemId1 =
        "Unique Data Item ID -- Get Approvals From Payer Test";
      const approvalDataItemId2 =
        "Unique Data Item ID 2 -- Get Approvals From Payer Test";

      await dbTestHelper.insertStubUser({
        user_address: payingAddress,
        winston_credit_balance: "1000",
      });

      await db.createDelegatedPaymentApproval({
        approvedWincAmount: W(500),
        approvalDataItemId: approvalDataItemId1,
        approvedAddress,
        payingAddress,
      });

      await db.createDelegatedPaymentApproval({
        approvedWincAmount: W(250),
        approvalDataItemId: approvalDataItemId2,
        approvedAddress,
        payingAddress,
      });

      const approvalsFromPayer = await db.getApprovalsFromPayerForAddress({
        payingAddress,
        approvedAddress,
      });

      expect(approvalsFromPayer.length).to.equal(2);
      expect(approvalsFromPayer[0].approvalDataItemId).to.equal(
        approvalDataItemId1
      );
      expect(approvalsFromPayer[1].approvalDataItemId).to.equal(
        approvalDataItemId2
      );
    });

    it("errors as expected when no approvals are found from a payer to a specific address", async () => {
      const payingAddress =
        "Paying Address -- Get Approvals From Payer Error Test";
      const approvedAddress =
        "Approved Address -- Get Approvals From Payer Error Test";

      await expectAsyncErrorThrow({
        promiseToError: db.getApprovalsFromPayerForAddress({
          payingAddress,
          approvedAddress,
        }),
        errorMessage: `No valid approvals found for approved address '${approvedAddress}' and paying address '${payingAddress}'`,
        errorType: "NoApprovalsFound",
      });
    });
  });

  describe("ArNS Purchase methods", () => {
    const owner = "Owner Address -- ArNS Name Purchase Test";
    beforeEach(async () => {
      await dbTestHelper
        .knex<UserDBResult>(tableNames.user)
        .where({ user_address: owner })
        .del();
      await dbTestHelper.insertStubUser({
        user_address: owner,
        winston_credit_balance: "1000",
      });
    });

    describe("createArNSPurchaseReceipt ", () => {
      it("creates a ArNS name purchase as expected", async () => {
        const nonce = "UniqueNonce -- Create Pending ArNS Purchase Test";

        const mARIOQty = new mARIOToken(500);
        const name = "Name -- Create Pending ArNS Purchase Test";
        const wincQty = W(500);

        await db.createArNSPurchaseReceipt({
          nonce,
          mARIOQty,
          name,
          owner,
          usdArRate: 1,
          usdArioRate: 1,
          type: "lease",
          wincQty,
          processId: stubTxId1,
          intent: "Buy-Name",
          years: 1,
          paidBy: [],
        });

        const pendingArNSPurchases = await dbTestHelper
          .knex<ArNSPurchaseDBResult>(tableNames.arNSPurchaseReceipt)
          .where({
            nonce,
          });

        expect(pendingArNSPurchases.length).to.equal(1);
        expect(pendingArNSPurchases[0].nonce).to.equal(nonce);
        expect(pendingArNSPurchases[0].mario_qty).to.equal("500");
        expect(pendingArNSPurchases[0].name).to.equal(name);
        expect(pendingArNSPurchases[0].usd_ar_rate).to.equal("1.00");
        expect(pendingArNSPurchases[0].owner).to.equal(owner);
        expect(pendingArNSPurchases[0].type).to.equal("lease");
        expect(pendingArNSPurchases[0].winc_qty).to.equal("500");
        expect(pendingArNSPurchases[0].process_id).to.equal(stubTxId1);
        expect(pendingArNSPurchases[0].years).to.equal(1);

        const user = await db.getUser(owner);
        expect(user.winstonCreditBalance.toString()).to.equal("500");
      });

      it("creates a pending ArNS name purchase with a multiple paidBys and the owner covering the rest", async () => {
        const payerOne = "payerOne -- Create Pending ArNS Purchase Test";
        const payerTwo = "payerTwo -- Create Pending ArNS Purchase Test";
        await dbTestHelper.insertStubUser({
          user_address: payerOne,
          winston_credit_balance: "1000",
        });
        await dbTestHelper.createStubDelegatedPaymentApproval({
          paying_address: payerOne,
          approved_address: owner,
          approved_winc_amount: "500",
        });
        await dbTestHelper.insertStubUser({
          user_address: payerTwo,
          winston_credit_balance: "1000",
        });
        await dbTestHelper.createStubDelegatedPaymentApproval({
          paying_address: payerTwo,
          approved_address: owner,
          approved_winc_amount: "500",
        });

        const nonce = "UniqueNonce -- Create Pending ArNS Purchase Test 2";

        await db.createArNSPurchaseReceipt({
          nonce,
          mARIOQty: new mARIOToken(500),
          name: "Name -- Create Pending ArNS Purchase Test 2",
          owner,
          usdArRate: 1,
          usdArioRate: 1,
          type: "lease",
          wincQty: W(1400),
          processId: stubTxId1,
          intent: "Buy-Name",
          years: 1,
          paidBy: [payerOne, payerTwo],
        });

        const pendingArNSPurchases = await dbTestHelper
          .knex<ArNSPurchaseDBResult>(tableNames.arNSPurchaseReceipt)
          .where({
            nonce,
          });
        expect(pendingArNSPurchases.length).to.equal(1);
        expect(pendingArNSPurchases[0].nonce).to.equal(nonce);
        expect(pendingArNSPurchases[0].overflow_spend).to.deep.equal([
          {
            winc_amount: "500",
            paying_address: "payerOne -- Create Pending ArNS Purchase Test",
          },
          {
            winc_amount: "500",
            paying_address: "payerTwo -- Create Pending ArNS Purchase Test",
          },
          {
            winc_amount: "400",
            paying_address: "Owner Address -- ArNS Name Purchase Test",
          },
        ]);
        expect(pendingArNSPurchases[0].paid_by).to.equal(
          payerOne + "," + payerTwo
        );

        const signer = await db.getUser(owner);
        expect(signer.winstonCreditBalance.toString()).to.equal("600");

        const inactiveApprovals = await dbTestHelper
          .knex<InactiveDelegatedPaymentApprovalDBResult>(
            tableNames.inactiveDelegatedPaymentApproval
          )
          .where({
            approved_address: owner,
            paying_address: payerOne,
          });
        expect(inactiveApprovals.length).to.equal(1);

        const inactiveApprovals2 = await dbTestHelper
          .knex<InactiveDelegatedPaymentApprovalDBResult>(
            tableNames.inactiveDelegatedPaymentApproval
          )
          .where({
            approved_address: owner,
            paying_address: payerTwo,
          });
        expect(inactiveApprovals2.length).to.equal(1);
      });

      it("errors as expected when the paidBy addresses and owner cannot cover the wincQty", async () => {
        // Create payer with two approvals
        const payerAddress =
          "payerAddress -- Create Pending ArNS Purchase Test 3";
        await dbTestHelper.insertStubUser({
          user_address: payerAddress,
          winston_credit_balance: "1000",
        });
        await dbTestHelper.createStubDelegatedPaymentApproval({
          paying_address: payerAddress,
          approved_address: owner,
          approved_winc_amount: "500",
        });
        await dbTestHelper.createStubDelegatedPaymentApproval({
          paying_address: payerAddress,
          approved_address: owner,
          approved_winc_amount: "500",
        });
        const nonce =
          "Unique Nonce -- Create Pending ArNS Purchase Error Test 3";
        const wincQty = W(2001); // owner balance = 1000, payer approvals = 1000, total balance = 2000, but wincQty = 2001

        await expectAsyncErrorThrow({
          promiseToError: db.createArNSPurchaseReceipt({
            nonce,
            mARIOQty: new mARIOToken(500),
            name: "Name -- Create Pending ArNS Purchase Error Test 3",
            owner,
            usdArRate: 1,
            usdArioRate: 1,
            type: "lease",
            wincQty,
            processId: stubTxId1,
            intent: "Buy-Name",
            years: 1,
            paidBy: [payerAddress],
          }),
          errorMessage: `Insufficient balance for '${owner}'`,
          errorType: "InsufficientBalance",
        });
      });

      it("errors as expected when the owner does not have enough balance to cover the wincQty", async () => {
        const nonce = "Unique Nonce -- Create Pending ArNS Purchase Error Test";

        const mARIOQty = new mARIOToken(500);
        const name = "Name -- Create Pending ArNS Purchase Error Test";
        const type = "lease";
        const wincQty = W(10000);

        await expectAsyncErrorThrow({
          promiseToError: db.createArNSPurchaseReceipt({
            nonce,
            mARIOQty,
            name,
            usdArRate: 1,
            usdArioRate: 1,
            owner,
            type,
            wincQty,
            processId: stubTxId1,
            years: 1,
            intent: "Buy-Name",
            paidBy: [],
          }),
          errorMessage: `Insufficient balance for '${owner}'`,
          errorType: "InsufficientBalance",
        });

        const pendingArNSPurchases = await dbTestHelper
          .knex<ArNSPurchaseDBResult>(tableNames.arNSPurchaseReceipt)
          .where({
            nonce,
          });

        expect(pendingArNSPurchases.length).to.equal(0);
      });

      it("errors as expected when the nonce conflicts with an existing pending ArNS name purchase", async () => {
        const nonce =
          "Unique Nonce -- Create Pending ArNS Purchase Error Test 2";

        const mARIOQty = new mARIOToken(500);
        const name = "Name -- Create Pending ArNS Purchase Error Test 2";
        const type = "lease";
        const wincQty = W(500);

        await db.createArNSPurchaseReceipt({
          nonce,
          mARIOQty,
          name,
          owner,
          type,
          usdArRate: 1,
          usdArioRate: 1,
          wincQty,
          processId: stubTxId1,
          intent: "Buy-Name",
          years: 1,
          paidBy: [],
        });

        await expectAsyncErrorThrow({
          promiseToError: db.createArNSPurchaseReceipt({
            nonce,
            mARIOQty,
            name,
            owner,
            type,
            usdArRate: 1,
            usdArioRate: 1,
            wincQty,
            processId: stubTxId1,
            intent: "Buy-Name",
            years: 1,
            paidBy: [],
          }),
          errorMessage: `An ArNS name purchase for name 'Name -- Create Pending ArNS Purchase Error Test 2' already exists in the database with nonce 'Unique Nonce -- Create Pending ArNS Purchase Error Test 2'`,
          errorType: "ArNSPurchaseAlreadyExists",
        });

        const pendingArNSPurchases = await dbTestHelper
          .knex<ArNSPurchaseDBResult>(tableNames.arNSPurchaseReceipt)
          .where({
            nonce,
          });

        expect(pendingArNSPurchases.length).to.equal(1);
      });
    });

    describe("updateFailedArNSPurchase method", () => {
      it("updates a failed ArNS name purchase as expected", async () => {
        const nonce = "Unique Nonce -- Update Failed ArNS Purchase Test";
        const failedReason =
          "Failed Reason -- Update Failed ArNS Purchase Test";

        await dbTestHelper.insertStubArNSPurchase({
          nonce,
          owner,
        });

        await db.updateFailedArNSPurchase(nonce, failedReason);

        const failedArNSPurchases = await dbTestHelper
          .knex<FailedArNSPurchaseDBResult>(tableNames.failedArNSPurchase)
          .where({
            nonce,
          });

        expect(failedArNSPurchases.length).to.equal(1);
        expect(failedArNSPurchases[0].nonce).to.equal(nonce);
        expect(failedArNSPurchases[0].failed_reason).to.equal(failedReason);

        const pendingArNSPurchases = await dbTestHelper
          .knex<ArNSPurchaseDBResult>(tableNames.arNSPurchaseReceipt)
          .where({
            nonce,
          });

        expect(pendingArNSPurchases.length).to.equal(0);
      });

      it("refunds approvals as expected when the ArNS name purchase fails", async () => {
        const payerAddress =
          "payerAddress -- Update Failed ArNS Purchase Test 2";
        await dbTestHelper.insertStubUser({
          user_address: payerAddress,
          winston_credit_balance: "1000",
        });
        await dbTestHelper.createStubDelegatedPaymentApproval({
          paying_address: payerAddress,
          approved_address: owner,
          approved_winc_amount: "1000",
          used_winc_amount: "500",
        });
        const nonce = "Unique Nonce -- Update Failed ArNS Purchase Test 2";
        await dbTestHelper.insertStubArNSPurchase({
          nonce,
          owner,
          paid_by: payerAddress,
          overflow_spend: JSON.stringify([
            {
              winc_amount: "500",
              paying_address: payerAddress,
            },
            {
              winc_amount: "500",
              paying_address: owner,
            },
          ]),
          winc_qty: "1000",
        });
        await db.updateFailedArNSPurchase(
          nonce,
          "Failed Reason -- Update Failed ArNS Purchase Test 2"
        );
        const failedArNSPurchases = await dbTestHelper
          .knex<FailedArNSPurchaseDBResult>(tableNames.failedArNSPurchase)
          .where({
            nonce,
          });
        expect(failedArNSPurchases.length).to.equal(1);
        expect(failedArNSPurchases[0].nonce).to.equal(nonce);
        expect(failedArNSPurchases[0].overflow_spend).to.deep.equal([
          {
            winc_amount: "500",
            paying_address: payerAddress,
          },
          {
            winc_amount: "500",
            paying_address: owner,
          },
        ]);

        const approval = await dbTestHelper
          .knex<DelegatedPaymentApprovalDBResult>(
            tableNames.delegatedPaymentApproval
          )
          .where({
            paying_address: payerAddress,
            approved_address: owner,
          });
        expect(approval.length).to.equal(1);

        // The winc amount from failed purchase is refunded to the approval
        expect(approval[0].used_winc_amount).to.equal("0");

        // The owner's balance is increased by the overflow winc amount from the failed purchase
        const user = await db.getUser(owner);
        expect(user.winstonCreditBalance.toString()).to.equal("1500");
      });

      it("errors as expected when the nonce does not exist in the pending ArNS name purchase table", async () => {
        const nonce = "Unique nonce -- Update Failed ArNS Purchase Error Test";
        const failedReason =
          "Failed Reason -- Update Failed ArNS Purchase Error Test";

        await expectAsyncErrorThrow({
          promiseToError: db.updateFailedArNSPurchase(nonce, failedReason),
          errorMessage: `No ArNS name purchase found in the database with nonce 'Unique nonce -- Update Failed ArNS Purchase Error Test'`,
          errorType: "ArNSPurchaseNotFound",
        });
      });
    });

    describe("getArNSPurchaseStatus method", () => {
      it("gets the ArNS name purchase status as expected", async () => {
        const name = "Name -- Get ArNS Purchase Status Test";
        const nonce = "Unique Nonce -- Get ArNS Purchase Status Test";

        await dbTestHelper.insertStubArNSPurchase({
          name,
          nonce,
        });

        const arNSNamePurchase = await db.getArNSPurchaseStatus(nonce);

        expect(arNSNamePurchase).to.exist;
        expect(arNSNamePurchase?.name).to.equal(name);
        expect(arNSNamePurchase?.nonce).to.equal(nonce);
        expect(arNSNamePurchase?.intent).to.equal("Buy-Name");
        expect(arNSNamePurchase?.owner).to.equal("The Stubbiest Owner");
        expect(arNSNamePurchase?.mARIOQty.toString()).to.equal("100");
        expect(arNSNamePurchase?.wincQty.toString()).to.equal("100");
        expect(arNSNamePurchase?.type).to.equal("permabuy");
        expect(arNSNamePurchase?.processId).to.be.undefined;
        expect(arNSNamePurchase?.years).to.be.undefined;
        expect(arNSNamePurchase?.increaseQty).to.be.undefined;
        expect((arNSNamePurchase as ArNSPurchase)?.createdDate).to.exist;
      });

      it("returns undefined when the ArNS name purchase does not exist", async () => {
        const name = "Name -- Get ArNS Purchase Status Error Test";

        const arNSNamePurchase = await db.getArNSPurchaseStatus(name);

        expect(arNSNamePurchase).to.be.undefined;
      });
    });
  });

  describe("ArNS Purchase Quote methods", () => {
    const owner = "Owner Address -- ArNS Quote Test";
    const nonce = "Unique Nonce -- ArNS Quote Test";

    beforeEach(async () => {
      await dbTestHelper
        .knex<UserDBResult>(tableNames.user)
        .where({ user_address: owner })
        .del();

      await dbTestHelper.insertStubUser({
        user_address: owner,
        winston_credit_balance: "1000",
      });

      await dbTestHelper
        .knex<ArNSPurchaseQuoteDBResult>(tableNames.arNSPurchaseQuote)
        .where({ nonce })
        .del();
    });

    it("creates and fetches an ArNS purchase quote as expected", async () => {
      const quote = await db.createArNSPurchaseQuote({
        currencyType: "SOL",
        intent: "Buy-Name",
        mARIOQty: new mARIOToken(200),
        name: "TestName",
        nonce,
        owner,
        paymentAmount: 1000,
        paymentProvider: "stripe",
        quoteExpirationDate: new Date().toISOString(),
        quotedPaymentAmount: 1000,
        usdArRate: 1.0,
        usdArioRate: 2.0,
        wincQty: W(100),
        increaseQty: undefined,
        processId: "txId123",
        type: "lease",
        years: 1,
        adjustments: [],
        excessWincAmount: W("300"),
      });

      expect(quote).to.exist;
      expect(quote.nonce).to.equal(nonce);
      expect(quote.name).to.equal("TestName");
      expect(quote.owner).to.equal(owner);
      expect(quote.intent).to.equal("Buy-Name");
      expect(quote.type).to.equal("lease");
      expect(quote.mARIOQty.toString()).to.equal("200");
      expect(quote.wincQty.toString()).to.equal("100");
      expect(quote.excessWincAmount.toString()).to.equal("300");
      expect(quote.paymentAmount).to.equal(1000);
      expect(quote.quotedPaymentAmount).to.equal(1000);
      expect(quote.paymentProvider).to.equal("stripe");
      expect(quote.years).to.equal(1);

      const { quote: fetched } = await db.getArNSPurchaseQuote(nonce);
      expect(fetched).to.deep.equal(quote);
    });

    it("creates and fetches an ArNS purchase quote with payment adjustments as expected", async () => {
      await db.createArNSPurchaseQuote({
        currencyType: "usd",
        intent: "Buy-Name",
        mARIOQty: new mARIOToken(200),
        name: "TestName",
        nonce,
        owner,
        paymentAmount: 1000,
        paymentProvider: "stripe",
        quoteExpirationDate: new Date().toISOString(),
        quotedPaymentAmount: 1000,
        usdArRate: 1.0,
        usdArioRate: 2.0,
        wincQty: W(100),
        increaseQty: undefined,
        processId: "txId123",
        type: "lease",
        years: 1,
        excessWincAmount: W("0"),
        adjustments: [
          {
            adjustmentAmount: 100,
            catalogId: "Catalog ID",
            name: "Adjustment Name",
            currencyType: "usd",
            description: "Adjustment Description",
            operator: "add",
            operatorMagnitude: 0.8,
          },
        ],
      });

      const adjustmentDbResult = await dbTestHelper
        .knex<PaymentAdjustmentDBResult>(tableNames.paymentAdjustment)
        .where({
          top_up_quote_id: nonce,
        });
      expect(adjustmentDbResult.length).to.equal(1);
    });

    it("returns undefined if the quote is not found", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.getArNSPurchaseQuote("non-existent-nonce"),
        errorMessage: `No ArNS name purchase found in the database with nonce 'non-existent-nonce'`,
        errorType: "ArNSPurchaseNotFound",
      });
    });

    it("updates an ArNS purchase quote to success", async () => {
      const nonce = "Unique Nonce -- Update ArNS Purchase Success Test";
      await dbTestHelper.insertStubArNSQuote({ nonce, owner });

      await db.updateArNSPurchaseQuoteToSuccess({
        nonce,
        messageId: "messageId",
      });

      const quote = await dbTestHelper
        .knex<ArNSPurchaseDBResult>(tableNames.arNSPurchaseReceipt)
        .where({ nonce })
        .first();

      expect(quote).to.exist;
      expect(quote?.nonce).to.equal(nonce);

      const auditLog = await dbTestHelper
        .knex(tableNames.auditLog)
        .where({ change_id: nonce });
      expect(auditLog.length).to.equal(1);
      expect(auditLog[0].user_address).to.equal(owner);
      expect(auditLog[0].winston_credit_amount).to.equal("0");
      expect(auditLog[0].change_reason).to.equal("arns_purchase_order");
      expect(auditLog[0].change_id).to.equal(nonce);

      await expectAsyncErrorThrow({
        promiseToError: db.getArNSPurchaseQuote(nonce),
        errorMessage: `No ArNS name purchase found in the database with nonce '${nonce}'`,
        errorType: "ArNSPurchaseNotFound",
      });
    });

    const messageId = "messageId";

    it("updates an ArNS purchase quote to success and distributes excess credits to new user", async () => {
      const nonce =
        "Unique Nonce -- Update ArNS Purchase Success Test -- Excess credits to existing owner";
      const owner = "unique user address 111";
      await dbTestHelper.insertStubUser({
        user_address: owner,
        winston_credit_balance: "100",
      });
      const excessWinc = W(100);
      await dbTestHelper.insertStubArNSQuote({
        nonce,
        excess_winc: excessWinc.toString(),
        owner,
      });

      await db.updateArNSPurchaseQuoteToSuccess({ nonce, messageId });

      const quote = await dbTestHelper
        .knex<ArNSPurchaseDBResult>(tableNames.arNSPurchaseReceipt)
        .where({ nonce })
        .first();
      expect(quote).to.exist;
      expect(quote?.nonce).to.equal(nonce);

      const auditLog = await dbTestHelper
        .knex(tableNames.auditLog)
        .where({ change_id: nonce });

      expect(auditLog.length).to.equal(1);
      expect(auditLog[0].user_address).to.equal(owner);
      expect(auditLog[0].winston_credit_amount).to.equal("100");
      expect(auditLog[0].change_reason).to.equal("arns_purchase_order");
      expect(auditLog[0].change_id).to.equal(nonce);

      const user = await db.getUser(owner);
      expect(user.winstonCreditBalance.toString()).to.equal("200");
    });

    it("updates an ArNS purchase quote to success and distributes excess credits to new user", async () => {
      const nonce = "Unique Nonce -- Update ArNS Purchase Success Test 2";
      const owner = "unique user address";
      const excessWinc = W(100);
      await dbTestHelper.insertStubArNSQuote({
        nonce,
        excess_winc: excessWinc.toString(),
        owner,
      });

      await db.updateArNSPurchaseQuoteToSuccess({ nonce, messageId });

      const quote = await dbTestHelper
        .knex<ArNSPurchaseDBResult>(tableNames.arNSPurchaseReceipt)
        .where({ nonce })
        .first();

      expect(quote).to.exist;
      expect(quote?.nonce).to.equal(nonce);

      const auditLog = await dbTestHelper
        .knex(tableNames.auditLog)
        .where({ change_id: nonce });

      expect(auditLog.length).to.equal(1);
      expect(auditLog[0].user_address).to.equal(owner);
      expect(auditLog[0].winston_credit_amount).to.equal("100");
      expect(auditLog[0].change_reason).to.equal("arns_account_creation");
      expect(auditLog[0].change_id).to.equal(nonce);

      const user = await db.getUser(owner);
      expect(user.winstonCreditBalance.toString()).to.equal(
        excessWinc.toString()
      );
    });

    it("updates an ArNS purchase quote to failure", async () => {
      await dbTestHelper.insertStubArNSQuote({
        nonce,
      });

      await db.updateArNSPurchaseQuoteToFailure(
        nonce,
        "Quote failed due to timeout"
      );

      const failedQuote = await dbTestHelper
        .knex<FailedArNSPurchaseDBResult>(tableNames.failedArNSPurchase)
        .where({ nonce })
        .first();

      expect(failedQuote).to.exist;
      expect(failedQuote?.failed_reason).to.equal(
        "Quote failed due to timeout"
      );

      await expectAsyncErrorThrow({
        promiseToError: db.getArNSPurchaseQuote(nonce),
        errorMessage: `No ArNS name purchase found in the database with nonce '${nonce}'`,
        errorType: "ArNSPurchaseNotFound",
      });
    });

    it("throws ArNSPurchaseNotFound when trying to mark a non-existent quote as failed", async () => {
      const fakeNonce = "non-existent-quote-failure";

      await expectAsyncErrorThrow({
        promiseToError: db.updateArNSPurchaseQuoteToFailure(
          fakeNonce,
          "Some failure"
        ),
        errorMessage: `No ArNS name purchase found in the database with nonce '${fakeNonce}'`,
        errorType: "ArNSPurchaseNotFound",
      });
    });

    it("throws ArNSPurchaseNotFound when trying to mark a non-existent quote as success", async () => {
      const fakeNonce = "non-existent-quote-success";

      await expectAsyncErrorThrow({
        promiseToError: db.updateArNSPurchaseQuoteToSuccess({
          nonce: fakeNonce,
          messageId,
        }),
        errorMessage: `No ArNS name purchase found in the database with nonce '${fakeNonce}'`,
        errorType: "ArNSPurchaseNotFound",
      });
    });
  });
});
