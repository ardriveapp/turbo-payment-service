import { expect } from "chai";

import { DbTestHelper } from "../../tests/dbTestHelper";
import { expectAsyncErrorThrow } from "../../tests/helpers/testHelpers";
import { Winston } from "../types/winston";
import { tableNames } from "./dbConstants";
import {
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

    it("creates the expected top_up_quote in the database entity", async () => {
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

    it("gets the expected top_up_quote database entities", async () => {
      const pantsQuote = await db.getTopUpQuote(pantsId);
      const shortsQuote = await db.getTopUpQuote(shortsId);

      expect(pantsQuote.topUpQuoteId).to.equal(pantsId);
      expect(shortsQuote.topUpQuoteId).to.equal(shortsId);
    });
  });

  describe("createPaymentReceipt method", () => {
    const newUserAddress = "New User 👶";
    const oldUserAddress = "Old User 🧓";

    const newUserTopUpId = "New Top Up ID";
    const oldUserTopUpId = "Old Top Up ID";

    before(async () => {
      // TODO: Before sending to DB and creating top up quote we should use safer types:
      // -  validate this address is a public arweave address (and address type is arweave for MVP)
      // -  validate payment provider is expected
      // -  validate currency type is supported

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
        winston_credit_balance: "100",
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
        winstonCreditAmount: new Winston(500),
      });
    });

    after(async () => {
      await dbTestHelper.cleanUpEntityInDb(
        tableNames.paymentReceipt,
        "A New Top Up ID"
      );
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

      expect(oldUser[0].winston_credit_balance).to.equal("600");
    });

    it("expires the top up quotes as expected", async () => {
      const newUserTopUpQuote = await db.getTopUpQuote(newUserTopUpId);
      const oldUserTopUpQuote = await db.getTopUpQuote(oldUserTopUpId);

      expect(
        new Date(newUserTopUpQuote.quoteExpirationDate).getTime()
      ).to.be.lessThan(new Date().getTime());
      expect(
        new Date(oldUserTopUpQuote.quoteExpirationDate).getTime()
      ).to.be.lessThan(new Date().getTime());
    });

    it("errors as expected when no top up quote can be expired", async () => {
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

      const k = await db.getPaymentReceipt("This is fine");
      console.log("k", k);

      await expectAsyncErrorThrow({
        promiseToError: db.getPaymentReceipt("This is fine"),
        errorMessage:
          "No top up quote found in database for payment receipt id 'This is fine'",
      });
    });
  });

  describe("getPaymentReceipt method", () => {
    const grapesId = "Grapes 🍇";
    const strawberriesId = "Strawberries 🍓";

    before(async () => {
      // TODO: At a database level, should we disallow two payment receipts with the same top_up_quote_id?
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

    it("gets the expected top_up_quote database entities", async () => {
      const grapesReceipt = await db.getPaymentReceipt(grapesId);
      const strawberriesReceipt = await db.getPaymentReceipt(strawberriesId);

      expect(grapesReceipt.paymentReceiptId).to.equal(grapesId);
      expect(strawberriesReceipt.paymentReceiptId).to.equal(strawberriesId);
    });

    // TODO: Error when not found
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

    // TODO: Error when not found
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

    // TODO: Error when not found
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

    // TODO: Error when not found
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

    // TODO: Error when user not found
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

    // TODO: Error when user not found
  });
});
