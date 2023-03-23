import { expect } from "chai";

import { Winston } from "../types/winston";
import { TopUpQuoteDBResult } from "./dbTypes";
import { PostgresDatabase } from "./postgres";

/** Knex instance connected to a PostgreSQL database */

describe("PostgresDatabase class", () => {
  const db = new PostgresDatabase();

  describe("createTopUpQuote method", () => {
    it("creates the expected top_up_quote in the database entity", async () => {
      const quoteExpirationDate = Date.now().toString();

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

      const topUpQuote = await db["knex"]<TopUpQuoteDBResult>(
        "top_up_quote"
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
      expect(quote_expiration_date).to.equal(quoteExpirationDate);
      expect(top_up_quote_id).to.equal("Unique Identifier");
      expect(winston_credit_amount).to.equal("500");
    });
  });
});
