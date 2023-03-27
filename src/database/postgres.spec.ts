import { expect } from "chai";

import { DbTestHelper } from "../../tests/dbTestHelper";
import { expectAsyncErrorThrow } from "../../tests/helpers/testHelpers";
import { Winston } from "../types/winston";
import { tableNames } from "./dbConstants";
import {
  ChargebackReceiptDBResult,
  PaymentReceiptDBResult,
  TopUpQuoteDBResult,
  UserDBResult,
} from "./dbTypes";
import { PostgresDatabase } from "./postgres";

/** Knex instance connected to a PostgreSQL database */

describe("PostgresDatabase class", () => {
  const db = new PostgresDatabase();
  const dbTestHelper = new DbTestHelper(db);

  describe("createTopUpQuote method", () => {
    const quoteExpirationDate = new Date(
      "2023-03-23 12:34:56.789Z"
    ).toISOString();

    before(async () => {
      // TODO: Before sending to DB and creating top up quote we should use safer types:
      // -  validate this address is a public arweave address (and address type is arweave)
      // -  validate payment provider is expected
      // -  validate currency type is supported
      await db.createTopUpQuote({
        amount: 100,
        currencyType: "usd",
        destinationAddress: "XYZ",
        destinationAddressType: "arweave",
        quoteExpirationDate,
        paymentProvider: "stripe",
        topUpQuoteId: "Unique Identifier",
        winstonCreditAmount: new Winston(500),
      });
    });

    after(async () => {
      await dbTestHelper.cleanUpEntityInDb(
        tableNames.topUpQuote,
        "Unique Identifier"
      );
    });

    it("creates the expected top up quote in the database", async () => {
      const topUpQuote = await db["knex"]<TopUpQuoteDBResult>(
        tableNames.topUpQuote
      ).where({ top_up_quote_id: "Unique Identifier" });
      expect(topUpQuote.length).to.equal(1);

      const {
        amount,
        currency_type,
        destination_address,
        destination_address_type,
        payment_provider,
        quote_creation_date,
        quote_expiration_date,
        top_up_quote_id,
        winston_credit_amount,
      } = topUpQuote[0];

      expect(amount).to.equal("100");
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
  });

  describe("getTopUpQuote method", () => {
    const pantsId = "Pants 👖";
    const shortsId = "Shorts 🩳";

    before(async () => {
      await dbTestHelper.insertStubTopUpQuote({ top_up_quote_id: pantsId });
      await dbTestHelper.insertStubTopUpQuote({ top_up_quote_id: shortsId });
    });

    after(async () => {
      await dbTestHelper.cleanUpEntityInDb(tableNames.topUpQuote, pantsId);
      await dbTestHelper.cleanUpEntityInDb(tableNames.topUpQuote, shortsId);
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

  describe("expireTopUpQuote method", () => {
    const sunnyId = "Sunny 🌞";

    before(async () => {
      await dbTestHelper.insertStubTopUpQuote({ top_up_quote_id: sunnyId });
    });

    after(async () => {
      await dbTestHelper.cleanUpEntityInDb(tableNames.topUpQuote, sunnyId);
    });

    it("deletes the top_up_quote entity and inserts a failed_top_up_quote", async () => {
      await db.expireTopUpQuote(sunnyId);

      const topUpQuoteDbResults = await db["knex"]<TopUpQuoteDBResult>(
        tableNames.topUpQuote
      ).where({ top_up_quote_id: sunnyId });
      expect(topUpQuoteDbResults.length).to.equal(0);

      const failedTopUpQuoteDbResults = await db["knex"]<TopUpQuoteDBResult>(
        tableNames.topUpQuote
      ).where({ top_up_quote_id: sunnyId });
      expect(failedTopUpQuoteDbResults.length).to.equal(1);
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
        top_up_quote_id: newUserTopUpId,
      });
      await db.createPaymentReceipt({
        amount: 10101,
        currencyType: "can",
        destinationAddress: newUserAddress,
        destinationAddressType: "arweave",
        topUpQuoteId: newUserTopUpId,
        paymentProvider: "stripe",
        paymentReceiptId: "Unique Identifier",
        winstonCreditAmount: new Winston(
          Number.MAX_SAFE_INTEGER.toString() + "00"
        ),
      });

      await dbTestHelper.insertStubUser({
        user_address: oldUserAddress,
        winston_credit_balance: oldUserBalance.toString(),
      });

      // Create Payment Receipt for Existing User
      await dbTestHelper.insertStubTopUpQuote({
        top_up_quote_id: oldUserTopUpId,
      });
      await db.createPaymentReceipt({
        amount: 1337,
        currencyType: "fra",
        destinationAddress: oldUserAddress,
        destinationAddressType: "arweave",
        topUpQuoteId: oldUserTopUpId,
        paymentProvider: "stripe",
        paymentReceiptId: "An Existing User's Unique Identifier",
        winstonCreditAmount: oldUserPaymentAmount,
      });
    });

    after(async () => {
      await Promise.all([
        dbTestHelper.cleanUpEntityInDb(
          tableNames.paymentReceipt,
          "Unique Identifier"
        ),
        dbTestHelper.cleanUpEntityInDb(
          tableNames.paymentReceipt,
          "An Existing User's Unique Identifier"
        ),
        dbTestHelper.cleanUpEntityInDb(tableNames.topUpQuote, oldUserTopUpId),
        dbTestHelper.cleanUpEntityInDb(tableNames.topUpQuote, newUserTopUpId),
        dbTestHelper.cleanUpEntityInDb(tableNames.user, oldUserAddress),
        dbTestHelper.cleanUpEntityInDb(tableNames.user, newUserAddress),
      ]);
    });

    it("creates the expected payment_receipt in the database entity", async () => {
      const paymentReceipt = await db["knex"]<PaymentReceiptDBResult>(
        tableNames.paymentReceipt
      ).where({ payment_receipt_id: "Unique Identifier" });
      expect(paymentReceipt.length).to.equal(1);

      const {
        amount,
        currency_type,
        destination_address,
        destination_address_type,
        payment_provider,
        payment_receipt_date,
        payment_receipt_id,
        top_up_quote_id,
        winston_credit_amount,
      } = paymentReceipt[0];

      expect(amount).to.equal("10101");
      expect(currency_type).to.equal("can");
      expect(destination_address).to.equal(newUserAddress);
      expect(destination_address_type).to.equal("arweave");
      expect(payment_provider).to.equal("stripe");
      expect(payment_receipt_date).to.exist;
      expect(payment_receipt_id).to.equal("Unique Identifier");
      expect(top_up_quote_id).to.equal(newUserTopUpId);
      expect(winston_credit_amount).to.equal(
        Number.MAX_SAFE_INTEGER.toString() + "00"
      );
    });

    it("creates the expected new user as expected when an existing user address cannot be found", async () => {
      const user = await db["knex"]<UserDBResult>(tableNames.user).where({
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
      expect(winston_credit_balance).to.equal(
        Number.MAX_SAFE_INTEGER.toString() + "00"
      );
    });

    it("increments existing user's balance as expected", async () => {
      const oldUser = await db["knex"]<UserDBResult>(tableNames.user).where({
        user_address: oldUserAddress,
      });
      expect(oldUser.length).to.equal(1);

      expect(oldUser[0].winston_credit_balance).to.equal(
        oldUserBalance.plus(oldUserPaymentAmount).toString()
      );
    });

    it("deletes the top_up_quote and inserts a new fulfilled_top_up_quote as expected", async () => {
      const topUpQuoteDbResults = await db["knex"]<TopUpQuoteDBResult>(
        tableNames.topUpQuote
      );
      expect(topUpQuoteDbResults.map((r) => r.top_up_quote_id)).to.not.include([
        newUserTopUpId,
        oldUserTopUpId,
      ]);

      const fulfilledTopUpQuoteDbResults = await db["knex"]<TopUpQuoteDBResult>(
        tableNames.fulfilledTopUpQuote
      );
      expect(
        fulfilledTopUpQuoteDbResults.map((r) => r.top_up_quote_id)
      ).to.not.include([newUserTopUpId, oldUserTopUpId]);
    });

    it("errors as expected when no top up quote can not be expired", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.createPaymentReceipt({
          amount: 1,
          currencyType: "usd",
          destinationAddress: "will fail",
          destinationAddressType: "arweave",
          topUpQuoteId: "A Top Up Quote ID That will be NOT FOUND",
          paymentProvider: "stripe",
          paymentReceiptId: "This is fine",
          winstonCreditAmount: new Winston(500),
        }),
        errorMessage:
          "No top up quote found in database for payment receipt id 'This is fine'",
      });

      expect(
        (
          await db["knex"](tableNames.paymentReceipt).where({
            payment_receipt_id: "This is fine",
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

    after(async () => {
      await dbTestHelper.cleanUpEntityInDb("payment_receipt", grapesId);
      await dbTestHelper.cleanUpEntityInDb("payment_receipt", strawberriesId);
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
          "No payment receipt found in database with ID 'Non Existent ID'",
      });
    });
  });

  describe("createChargebackReceipt method", () => {
    const naughtyUserAddress = "Naughty User 💀";

    const naughtyUserBalance = new Winston("1000");

    before(async () => {
      await dbTestHelper.insertStubUser({
        user_address: naughtyUserAddress,
        winston_credit_balance: naughtyUserBalance.toString(),
      });
      await db.createChargebackReceipt({
        amount: 11_111,
        currencyType: "eth",
        destinationAddress: naughtyUserAddress,
        destinationAddressType: "arweave",
        paymentReceiptId: "Bad Payment Receipt Address",
        paymentProvider: "stripe",
        chargebackReceiptId: "A great Unique Identifier",
        chargebackReason: "Evil",
        winstonCreditAmount: new Winston(999),
      });
    });

    after(async () => {
      await Promise.all([
        dbTestHelper.cleanUpEntityInDb(
          tableNames.chargebackReceipt,
          "A great Unique Identifier"
        ),

        dbTestHelper.cleanUpEntityInDb(tableNames.user, naughtyUserAddress),
      ]);
    });

    it("creates the expected chargeback receipt in the database", async () => {
      const chargebackReceipt = await db["knex"]<ChargebackReceiptDBResult>(
        tableNames.chargebackReceipt
      ).where({ chargeback_receipt_id: "A great Unique Identifier" });
      expect(chargebackReceipt.length).to.equal(1);

      const {
        amount,
        currency_type,
        destination_address,
        destination_address_type,
        payment_provider,
        chargeback_receipt_date,
        chargeback_receipt_id,
        payment_receipt_id,
        winston_credit_amount,
      } = chargebackReceipt[0];

      expect(amount).to.equal("11111");
      expect(currency_type).to.equal("eth");
      expect(destination_address).to.equal(naughtyUserAddress);
      expect(destination_address_type).to.equal("arweave");
      expect(payment_provider).to.equal("stripe");
      expect(chargeback_receipt_date).to.exist;
      expect(chargeback_receipt_id).to.equal("A great Unique Identifier");
      expect(payment_receipt_id).to.equal("Bad Payment Receipt Address");
      expect(winston_credit_amount).to.equal("999");
    });

    it("decrements user's balance as expected", async () => {
      const oldUser = await db["knex"]<UserDBResult>(tableNames.user).where({
        user_address: naughtyUserAddress,
      });
      expect(oldUser.length).to.equal(1);

      expect(oldUser[0].winston_credit_balance).to.equal(
        naughtyUserBalance.minus(new Winston("999")).toString()
      );
    });

    it("errors as expected when no user can be found to decrement balance", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.createChargebackReceipt({
          amount: 1,
          currencyType: "usd",
          destinationAddress: "Non Existent User Address",
          destinationAddressType: "arweave",
          paymentReceiptId: "Anything that can error",
          paymentProvider: "stripe",
          chargebackReceiptId: "Hey there",
          chargebackReason: "What is this column will be?",
          winstonCreditAmount: new Winston(500),
        }),
        errorMessage:
          "No user found in database with address 'Non Existent User Address'",
      });

      expect(
        (
          await db["knex"](tableNames.chargebackReceipt).where({
            chargeback_receipt_id: "Hey there",
          })
        ).length
      ).to.equal(0);
    });

    it("errors as expected when no payment receipt could be found to chargeback", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.createChargebackReceipt({
          amount: 1337331,
          currencyType: "val",
          destinationAddress: "hello there",
          destinationAddressType: "arweave",
          paymentReceiptId: "No ID Found!!!!!",
          paymentProvider: "stripe",
          chargebackReceiptId: "chargeback receipts 1",
          chargebackReason: "Stripe Dispute Webhook Event",
          winstonCreditAmount: new Winston(500),
        }),
        errorMessage: `No payment receipt could be found with ID 'No ID Found!!!!!'`,
      });

      expect(
        (
          await db["knex"](tableNames.chargebackReceipt).where({
            chargeback_receipt_id: "Great value",
          })
        ).length
      ).to.equal(0);
    });

    it("errors as expected when user has no funds to decrement balance", async () => {
      const underfundedUserAddress = "Broke 😭";

      await dbTestHelper.insertStubUser({
        user_address: underfundedUserAddress,
        winston_credit_balance: "200",
      });

      await expectAsyncErrorThrow({
        promiseToError: db.createChargebackReceipt({
          amount: 1,
          currencyType: "eur",
          destinationAddress: underfundedUserAddress,
          destinationAddressType: "arweave",
          paymentReceiptId: "New ID",
          paymentProvider: "stripe",
          chargebackReceiptId: "Great value",
          chargebackReason: "What ?",
          winstonCreditAmount: new Winston(500),
        }),
        errorMessage: `User with address '${underfundedUserAddress}' does not have enough balance to decrement this chargeback!`,
      });

      expect(
        (
          await db["knex"](tableNames.chargebackReceipt).where({
            chargeback_receipt_id: "Great value",
          })
        ).length
      ).to.equal(0);
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

    after(async () => {
      await dbTestHelper.cleanUpEntityInDb("chargeback_receipt", breadId);
      await dbTestHelper.cleanUpEntityInDb("chargeback_receipt", greensId);
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

    after(async () => {
      await dbTestHelper.cleanUpEntityInDb(tableNames.user, goodAddress);
      await dbTestHelper.cleanUpEntityInDb(tableNames.user, evilAddress);
    });

    it("gets the expected user database entities", async () => {
      const pantsQuote = await db.getUser(goodAddress);
      const shortsQuote = await db.getUser(evilAddress);

      expect(pantsQuote.userAddress).to.equal(goodAddress);
      expect(shortsQuote.userAddress).to.equal(evilAddress);
    });

    it("errors as expected when user cannot be found", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.getUser("Non Existent Address"),
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

    after(async () => {
      await dbTestHelper.cleanUpEntityInDb(tableNames.user, unicornAddress);
    });

    it("gets the expected user database entities", async () => {
      const promoInfo = await db.getPromoInfo(unicornAddress);

      expect(promoInfo).to.deep.equal({});
    });

    it("errors as expected when user cannot be found", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.getPromoInfo("Non Existent Address"),
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

    after(async () => {
      await dbTestHelper.cleanUpEntityInDb(tableNames.user, privilegedAddress);
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

    it("errors as expected when user cannot be found", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.updatePromoInfo("Non Existent Address", {
          newPromo: true,
        }),
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

    after(async () => {
      await dbTestHelper.cleanUpEntityInDb(tableNames.user, richAddress);
      await dbTestHelper.cleanUpEntityInDb(tableNames.user, poorAddress);
    });

    it("reserves the balance as expected when winston balance is available", async () => {
      await db.reserveBalance(richAddress, new Winston(500));

      const richUser = await db.getUser(richAddress);

      expect(+richUser.winstonCreditBalance).to.equal(99_999_999_500);
    });

    it("throws an error as expected when winston balance is not available", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.reserveBalance(poorAddress, new Winston(200)),
        errorMessage: "User does not have enough balance!",
      });

      const poorUser = await db.getUser(poorAddress);

      expect(+poorUser.winstonCreditBalance).to.equal(10);
    });

    it("errors as expected when user cannot be found", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.reserveBalance(
          "Non Existent Address",
          new Winston(1337)
        ),
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

    after(async () => {
      await dbTestHelper.cleanUpEntityInDb(tableNames.user, happyAddress);
    });

    it("refunds the balance as expected", async () => {
      await db.refundBalance(happyAddress, new Winston(100_000));

      const happyUser = await db.getUser(happyAddress);

      expect(+happyUser.winstonCreditBalance).to.equal(102_000);
    });

    it("errors as expected when user cannot be found", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.refundBalance(
          "Non Existent Address",
          new Winston(1337)
        ),
        errorMessage:
          "No user found in database with address 'Non Existent Address'",
      });
    });
  });
});
