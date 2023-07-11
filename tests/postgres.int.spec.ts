import { expect } from "chai";

import { tableNames } from "../src/database/dbConstants";
import {
  ChargebackReceiptDBResult,
  PaymentReceiptDBResult,
  TopUpQuoteDBResult,
  UserDBResult,
} from "../src/database/dbTypes";
import { PostgresDatabase } from "../src/database/postgres";
import { Winston } from "../src/types/winston";
import { DbTestHelper } from "./dbTestHelper";
import { expectAsyncErrorThrow } from "./helpers/testHelpers";

describe("PostgresDatabase class", () => {
  const db = new PostgresDatabase();
  const dbTestHelper = new DbTestHelper(db);

  describe("createTopUpQuote method", () => {
    const quoteExpirationDate = new Date(
      "2023-03-23 12:34:56.789Z"
    ).toISOString();

    before(async () => {
      await db.createTopUpQuote({
        paymentAmount: 100,
        currencyType: "usd",
        destinationAddress: "XYZ",
        destinationAddressType: "arweave",
        quoteExpirationDate,
        paymentProvider: "stripe",
        topUpQuoteId: "Unique Identifier",
        winstonCreditAmount: new Winston(500),
      });
    });

    it("creates the expected top up quote in the database", async () => {
      const topUpQuote = await db["knexWriter"]<TopUpQuoteDBResult>(
        tableNames.topUpQuote
      ).where({ top_up_quote_id: "Unique Identifier" });
      expect(topUpQuote.length).to.equal(1);

      const {
        payment_amount,
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
      const paymentReceipt = await db["knexWriter"]<PaymentReceiptDBResult>(
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
      const user = await db["knexWriter"]<UserDBResult>(tableNames.user).where({
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
      const oldUser = await db["knexWriter"]<UserDBResult>(
        tableNames.user
      ).where({
        user_address: oldUserAddress,
      });
      expect(oldUser.length).to.equal(1);

      expect(oldUser[0].winston_credit_balance).to.equal(
        oldUserBalance.plus(oldUserPaymentAmount).toString()
      );
    });

    it("deletes the top_up_quotes as expected", async () => {
      const topUpQuoteDbResults = await db["knexWriter"]<TopUpQuoteDBResult>(
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
          await db["knexWriter"](tableNames.paymentReceipt).where({
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
          await db["knexWriter"](tableNames.paymentReceipt).where({
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
          await db["knexWriter"](tableNames.paymentReceipt).where({
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
      const chargebackReceipt = await db[
        "knexWriter"
      ]<ChargebackReceiptDBResult>(tableNames.chargebackReceipt).where({
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
        "knexWriter"
      ]<PaymentReceiptDBResult>(tableNames.paymentReceipt).where({
        payment_receipt_id: naughtyPaymentId,
      });
      expect(paymentReceiptDbResults.length).to.equal(0);
    });

    it("decrements user's balance as expected", async () => {
      const oldUser = await db["knexWriter"]<UserDBResult>(
        tableNames.user
      ).where({
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
          await db["knexWriter"](tableNames.chargebackReceipt).where({
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

      const negativeBalanceUserBefore = await db["knexWriter"]<UserDBResult>(
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

      const negativeBalanceAfter = await db["knexWriter"]<UserDBResult>(
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
          await db["knexWriter"](tableNames.chargebackReceipt).where({
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
      await db.reserveBalance(richAddress, new Winston(500));

      const richUser = await db.getUser(richAddress);

      expect(+richUser.winstonCreditBalance).to.equal(99_999_999_500);
    });

    it("throws an error as expected when winston balance is not available", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.reserveBalance(poorAddress, new Winston(200)),
        errorType: "InsufficientBalance",
        errorMessage: `Insufficient balance for '${poorAddress}'`,
      });
      const poorUser = await db.getUser(poorAddress);

      expect(+poorUser.winstonCreditBalance).to.equal(10);
    });

    it("throws a warning as expected when user cannot be found", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.reserveBalance(
          "Non Existent Address",
          new Winston(1337)
        ),
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
      await db.refundBalance(happyAddress, new Winston(100_000));

      const happyUser = await db.getUser(happyAddress);

      expect(+happyUser.winstonCreditBalance).to.equal(102_000);
    });

    it("throws a warning as expected when user cannot be found", async () => {
      await expectAsyncErrorThrow({
        promiseToError: db.refundBalance(
          "Non Existent Address",
          new Winston(1337)
        ),
        errorType: "UserNotFoundWarning",
        errorMessage:
          "No user found in database with address 'Non Existent Address'",
      });
    });
  });
});
