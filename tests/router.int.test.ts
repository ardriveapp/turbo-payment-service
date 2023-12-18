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
import Arweave from "arweave/node/common";
import axiosPackage from "axios";
import { expect } from "chai";
import { Server } from "http";
import { sign } from "jsonwebtoken";
import { spy, stub, useFakeTimers } from "sinon";
import Stripe from "stripe";

import {
  CurrencyLimitations,
  TEST_PRIVATE_ROUTE_SECRET,
  paymentAmountLimits,
} from "../src/constants";
import { tableNames } from "../src/database/dbConstants";
import {
  ChargebackReceiptDBResult,
  PaymentReceiptDBInsert,
  PaymentReceiptDBResult,
  RedeemedGiftDBResult,
  SingleUseCodePaymentCatalogDBResult,
  TopUpQuote,
  TopUpQuoteDBResult,
  UnredeemedGiftDBInsert,
  UnredeemedGiftDBResult,
  UserDBResult,
} from "../src/database/dbTypes.js";
import logger from "../src/logger";
import {
  CoingeckoArweaveToFiatOracle,
  ReadThroughArweaveToFiatOracle,
} from "../src/pricing/oracles/arweaveToFiatOracle";
import { FinalPrice, NetworkPrice } from "../src/pricing/price";
import { TurboPricingService } from "../src/pricing/pricing";
import { createServer } from "../src/server";
import { supportedPaymentCurrencyTypes } from "../src/types/supportedCurrencies";
import { Winston } from "../src/types/winston";
import { arweaveRSAModulusToAddress } from "../src/utils/jwkUtils";
import { signedRequestHeadersFromJwk } from "../tests/helpers/signData";
import { oneHourAgo, oneHourFromNow } from "./dbTestHelper";
import {
  chargeDisputeStub,
  checkoutSessionStub,
  checkoutSessionSuccessStub,
  expectedArPrices,
  paymentIntentStub,
  stripeResponseStub,
  stripeStubEvent,
  stubTxId1,
  stubTxId2,
} from "./helpers/stubs";
import { assertExpectedHeadersWithContentLength } from "./helpers/testExpectations";
import {
  axios,
  coinGeckoOracle,
  dbTestHelper,
  emailProvider,
  localTestUrl,
  paymentDatabase,
  pricingService,
  stripe,
  testAddress,
  testWallet,
} from "./helpers/testHelpers";

describe("Router tests", () => {
  let server: Server;

  function closeServer() {
    server.close();
    logger.info("Server closed!");
  }

  const routerTestPromoCode = "routerTestPromoCode";
  const routerTestPromoCodeCatalogId = "routerTestPromoCodeCatalogId";

  beforeEach(() => {
    stub(coinGeckoOracle, "getFiatPricesForOneAR").resolves(
      expectedArPrices.arweave
    );
  });

  before(async () => {
    await dbTestHelper.insertStubUser({
      user_address: testAddress,
      winston_credit_balance: "5000000",
    });

    server = await createServer({
      pricingService,
      paymentDatabase,
      stripe,
      emailProvider,
    });
    await paymentDatabase["writer"]<SingleUseCodePaymentCatalogDBResult>(
      tableNames.singleUseCodePaymentAdjustmentCatalog
    ).insert({
      code_value: routerTestPromoCode,
      adjustment_exclusivity: "exclusive",
      adjustment_name: "Router Test Promo Code",
      catalog_id: routerTestPromoCodeCatalogId,
      operator: "multiply",
      operator_magnitude: "0.8",
    });
  });

  after(() => {
    closeServer();
  });

  it("GET /health returns 'OK' in the body, a 200 status, and the correct content-length", async () => {
    const { status, statusText, headers, data } = await axios.get("/health");

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    assertExpectedHeadersWithContentLength(headers, 2);

    expect(data).to.equal("OK");
  });

  it("GET /price/bytes", async () => {
    const wincTotal = new Winston("1234567890");
    stub(pricingService, "getWCForBytes").resolves({
      finalPrice: new FinalPrice(wincTotal),
      networkPrice: new NetworkPrice(wincTotal),
      adjustments: [],
    });

    const { status, statusText, data } = await axios.get(
      `/v1/price/bytes/1024`
    );
    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    expect(+new Winston(data.winc)).to.equal(1234567890);
  });

  it("GET /price/arweave/:bytes", async () => {
    const wincTotal = new Winston("1234567890");
    stub(pricingService, "getWCForBytes").resolves({
      finalPrice: new FinalPrice(wincTotal),
      networkPrice: new NetworkPrice(wincTotal),
      adjustments: [],
    });

    const { status, statusText, data } = await axios.get(`/price/arweave/1024`);
    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    expect(+new Winston(data)).to.equal(1234567890);
  });

  it("GET /price/arweave/:bytes returns 400 for invalid byte count", async () => {
    const { status, statusText, data } = await axios.get(
      `/price/arweave/-54.2`
    );
    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
    expect(data).to.equal("Invalid byte count");
  });

  it("GET /price/arweave/:bytes returns 502 if bytes pricing oracle fails to get a price", async () => {
    stub(pricingService, "getWCForBytes").throws(Error("Serious failure"));
    const { status, statusText, data } = await axios.get(
      `/price/arweave/1321321`
    );
    expect(status).to.equal(502);
    expect(data).to.equal("Pricing Oracle Unavailable");
    expect(statusText).to.equal("Bad Gateway");
  });

  it("GET /price/bytes returns 400 for bytes > max safe integer", async () => {
    const { status, statusText, data } = await axios.get(
      `/v1/price/bytes/1024000000000000000000000000000000000000000000`
    );
    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
    expect(data).to.equal("Byte count too large");
  });

  it("GET /price/bytes returns 400 for invalid byte count", async () => {
    const { status, statusText, data } = await axios.get(
      `/v1/price/bytes/-54.2`
    );
    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
    expect(data).to.equal("Invalid byte count");
  });

  it("GET /price/bytes returns 502 if bytes pricing oracle fails to get a price", async () => {
    stub(pricingService, "getWCForBytes").throws(Error("Serious failure"));
    const { status, statusText, data } = await axios.get(
      `/v1/price/bytes/1321321`
    );
    expect(status).to.equal(502);
    expect(data).to.equal("Pricing Oracle Unavailable");
    expect(statusText).to.equal("Bad Gateway");
  });

  it("GET /price/:currency/:value returns 502 if fiat pricing oracle response is unexpected", async () => {
    stub(pricingService, "getWCForPayment").throws();
    const { data, status, statusText } = await axios.get(`/v1/price/usd/5000`);

    expect(status).to.equal(502);
    expect(statusText).to.equal("Bad Gateway");
    expect(data).to.equal("Fiat Oracle Unavailable");
  });

  it("GET /rates returns 502 if unable to fetch prices", async () => {
    stub(pricingService, "getWCForBytes").throws(Error("Serious failure"));

    const { status, statusText } = await axios.get(`/v1/rates`);

    expect(status).to.equal(502);
    expect(statusText).to.equal("Bad Gateway");
  });

  it("GET /rates returns the correct response", async () => {
    const fakeDateBeforeSubsidyAndInfraFee = new Date(
      "2021-01-01T00:00:00.000Z"
    );
    const clock = useFakeTimers(fakeDateBeforeSubsidyAndInfraFee.getTime());

    const { data, status, statusText } = await axios.get(`/v1/rates`);

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    expect(data).to.deep.equal({
      // No Infra Fee
      fiat: {
        aud: 8.888074843239,
        brl: 29.787061636803,
        cad: 8.055890229538,
        eur: 5.48212338304,
        gbp: 4.770047888842,
        hkd: 47.177146296308,
        inr: 493.502634370348,
        jpy: 809.295247212831,
        sgd: 7.987256446965,
        usd: 6.022614420805,
      },
      // No Subsidy
      winc: "857922282166",
      adjustments: [],
    });
    clock.restore();
  });

  it("GET /rates during twenty percent infra fee event returns the expected result", async () => {
    const fakeDateDuringTwentyPctInfraFee = new Date(
      "2023-01-02T00:00:00.000Z"
    );
    const clock = useFakeTimers(fakeDateDuringTwentyPctInfraFee.getTime());

    const { data, status, statusText } = await axios.get(`/v1/rates`);

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    expect(data).to.deep.equal({
      // No Subsidy
      fiat: {
        aud: 11.110093554049,
        brl: 37.233827046004,
        cad: 10.069862786923,
        eur: 6.8526542288,
        gbp: 5.962559861053,
        hkd: 58.971432870385,
        inr: 616.878292962935,
        jpy: 1011.619059016038,
        sgd: 9.984070558706,
        usd: 7.528268026006,
      },
      winc: "857922282166",
      adjustments: [],
    });
    clock.restore();
  });

  it("GET /rates during twenty three point four percent infra fee event and Sep - Oct Subsidy Event returns the expected result", async () => {
    const fakeDateDuringTwentyThreeFourPctInfraFeeAndSepOctSubsidyEvent =
      new Date("2023-09-25T00:00:00.000Z");
    const clock = useFakeTimers(
      fakeDateDuringTwentyThreeFourPctInfraFeeAndSepOctSubsidyEvent.getTime()
    );

    const { data, status, statusText } = await axios.get(`/v1/rates`);

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    expect(data.fiat).to.deep.equal({
      // 23.4% Infra Fee applied
      aud: 6.381776976212,
      brl: 21.387576893252,
      cad: 5.78425538674,
      eur: 3.936250470849,
      gbp: 3.424969110785,
      hkd: 33.873930108293,
      inr: 354.34262258945,
      jpy: 581.086665752968,
      sgd: 5.73497525565,
      usd: 4.324331503186,
    });

    // 45% Subsidy Event applied
    expect(data.winc).to.equal("471857255191");
    expect(data.adjustments[0].adjustmentAmount).to.equal("-386065026975");
    clock.restore();
  });

  it("GET /rates/:currency returns 404 for non supported currency", async () => {
    const { status, statusText, data } = await axios.get(`/v1/rates/abc`);
    expect(status).to.equal(404);
    expect(statusText).to.equal("Not Found");
    expect(data).to.equal("Invalid currency.");
  });

  it("GET /rates/:currency returns 502 if unable to fetch prices", async () => {
    stub(pricingService, "getFiatPriceForOneAR").throws();
    const { status, statusText } = await axios.get(`/v1/rates/usd`);
    expect(status).to.equal(502);
    expect(statusText).to.equal("Bad Gateway");
  });

  it("GET /rates/:currency returns the correct response for supported currency", async () => {
    const { data, status, statusText } = await axios.get(`/v1/rates/usd`);

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    expect(data).to.deep.equal({
      currency: "usd",
      rate: expectedArPrices.arweave.usd,
    });
  });

  it("GET /price/:currency/:value", async () => {
    const { status, statusText, data } = await axios.get(`/v1/price/USD/100`);

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    const {
      winc,
      actualPaymentAmount,
      quotedPaymentAmount,
      adjustments,
      fees,
    } = data;

    expect(+new Winston(winc)).to.equal(109686609687);
    expect(quotedPaymentAmount).to.equal(100);
    expect(actualPaymentAmount).to.equal(100);
    expect(fees).to.deep.equal([
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
    expect(adjustments).to.deep.equal([]);
  });

  it("GET /price/:currency/:value with a 20% off promoCode in query params returns expected result", async () => {
    const { status, statusText, data } = await axiosPackage
      .create({
        baseURL: localTestUrl,
        validateStatus: () => true,
      })
      .get(`/v1/price/USD/123?promoCode=${routerTestPromoCode}`, {
        headers: await signedRequestHeadersFromJwk(testWallet, "123"),
      });

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    const {
      winc,
      actualPaymentAmount,
      quotedPaymentAmount,
      adjustments,
      fees,
    } = data;

    expect(+new Winston(winc)).to.equal(133903133903);
    expect(quotedPaymentAmount).to.equal(123);
    expect(actualPaymentAmount).to.equal(98);
    expect(adjustments).to.deep.equal([
      {
        adjustmentAmount: -25,
        currencyType: "usd",
        description: "",
        name: "Router Test Promo Code",
        operator: "multiply",
        operatorMagnitude: 0.8,
        promoCode: routerTestPromoCode,
      },
    ]);
    expect(fees).to.deep.equal([
      {
        adjustmentAmount: -29,
        currencyType: "usd",
        description:
          "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
        name: "Turbo Infrastructure Fee",
        operator: "multiply",
        operatorMagnitude: 0.766,
      },
    ]);
  });

  it("GET /price/:currency/:value with a 20% off promoCode and destinationAddress in query params  returns expected result", async () => {
    const destinationAddress = "43CharactersABCDEFGHIJKLMNOPQRSTUVWXYZ12345";
    const { status, statusText, data } = await axiosPackage
      .create({
        baseURL: localTestUrl,
        validateStatus: () => true,
      })
      .get(
        `/v1/price/USD/123?promoCode=${routerTestPromoCode}&destinationAddress=${destinationAddress}`
      );

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    const {
      winc,
      actualPaymentAmount,
      quotedPaymentAmount,
      adjustments,
      fees,
    } = data;

    expect(+new Winston(winc)).to.equal(133903133903);
    expect(quotedPaymentAmount).to.equal(123);
    expect(actualPaymentAmount).to.equal(98);
    expect(adjustments).to.deep.equal([
      {
        adjustmentAmount: -25,
        currencyType: "usd",
        description: "",
        name: "Router Test Promo Code",
        operator: "multiply",
        operatorMagnitude: 0.8,
        promoCode: routerTestPromoCode,
      },
    ]);
    expect(fees).to.deep.equal([
      {
        adjustmentAmount: -29,
        currencyType: "usd",
        description:
          "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
        name: "Turbo Infrastructure Fee",
        operator: "multiply",
        operatorMagnitude: 0.766,
      },
    ]);
  });

  it("GET /price/:currency/:value with duplicate 20% off promoCodes in query params returns expected result", async () => {
    const { status, statusText, data } = await axiosPackage
      .create({
        baseURL: localTestUrl,
        validateStatus: () => true,
      })
      .get(
        `/v1/price/USD/1234?promoCode=${routerTestPromoCode}&promoCode=${routerTestPromoCode}`,
        {
          headers: await signedRequestHeadersFromJwk(testWallet, "123"),
        }
      );

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    const {
      winc,
      actualPaymentAmount,
      quotedPaymentAmount,
      adjustments,
      fees,
    } = data;

    expect(+new Winston(winc)).to.equal(1346153846154);
    expect(quotedPaymentAmount).to.equal(1234);
    expect(actualPaymentAmount).to.equal(987);
    expect(adjustments).to.deep.equal([
      {
        adjustmentAmount: -247,
        currencyType: "usd",
        description: "",
        name: "Router Test Promo Code",
        operator: "multiply",
        operatorMagnitude: 0.8,
        promoCode: "routerTestPromoCode",
      },
    ]);
    expect(fees).to.deep.equal([
      {
        adjustmentAmount: -289,
        currencyType: "usd",
        description:
          "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
        name: "Turbo Infrastructure Fee",
        operator: "multiply",
        operatorMagnitude: 0.766,
      },
    ]);
  });

  it("GET /price/:currency/:value with INVALID promoCode in query params returns a 400", async () => {
    const { status, statusText, data } = await axiosPackage
      .create({
        baseURL: localTestUrl,
        validateStatus: () => true,
      })
      .get(`/v1/price/USD/100?promoCode=fakeCodeLOL`, {
        headers: await signedRequestHeadersFromJwk(testWallet, "123"),
      });

    expect(data).to.equal("No promo code found with code 'fakeCodeLOL'");
    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
  });

  it("GET /price/:currency/:value with INELIGIBLE promoCode in query params returns a 400", async () => {
    const jwk = await Arweave.crypto.generateJWK();
    const userAddress = arweaveRSAModulusToAddress(jwk.n);

    await dbTestHelper.insertStubPaymentReceipt({
      payment_receipt_id: "unique id promo ineligible price fiat",
      top_up_quote_id: "used promo code id",
      destination_address: userAddress,
    });
    await dbTestHelper.insertStubPaymentAdjustment({
      catalog_id: routerTestPromoCodeCatalogId,
      top_up_quote_id: "used promo code id",
      user_address: userAddress,
    });

    const { status, statusText, data } = await axiosPackage
      .create({
        baseURL: localTestUrl,
        validateStatus: () => true,
      })
      // This wallet just used this code above... So we should now fail
      .get(`/v1/price/USD/100?promoCode=${routerTestPromoCode}`, {
        headers: await signedRequestHeadersFromJwk(jwk, "123"),
      });

    expect(data).to.equal(
      `The user '${userAddress}' is ineligible for the promo code '${routerTestPromoCode}'`
    );
    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
  });

  it("GET /price/:currency/:value with promoCode in query params but an unauthenticated request and lacking a destinationAddress returns a 400", async () => {
    const { status, statusText, data } = await axiosPackage
      .create({
        baseURL: localTestUrl,
        validateStatus: () => true,
      })
      .get(`/v1/price/USD/100?promoCode=${routerTestPromoCode}`);

    expect(data).to.equal(
      "Promo codes must be applied to a specific `destinationAddress` or to the request signer"
    );
    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
  });

  it("GET /price/:currency/:value returns 400 for invalid currency", async () => {
    const { data, status, statusText } = await axios.get(
      `/v1/price/Random-Currency/100`
    );
    expect(data).to.equal(
      "The currency type 'random-currency' is currently not supported by this API!"
    );
    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
  });

  it("GET /price/:currency/:value returns 400 for an invalid payment amount", async () => {
    const { data, status, statusText } = await axios.get(`/v1/price/usd/200.5`);
    expect(data).to.equal(
      "The provided payment amount (200.5) is invalid; it must be a positive non-decimal integer!"
    );
    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
  });

  it("GET /price/:currency/:value returns 502 if fiat pricing oracle fails to get a price", async () => {
    stub(pricingService, "getWCForPayment").throws(Error("Really bad failure"));
    const { data, status, statusText } = await axios.get(`/v1/price/usd/5000`);

    expect(status).to.equal(502);
    expect(statusText).to.equal("Bad Gateway");
    expect(data).to.equal("Fiat Oracle Unavailable");
  });

  it("GET /balance returns 200 for correct signature", async () => {
    const { status, statusText, data } = await axios.get(`/v1/balance`, {
      headers: await signedRequestHeadersFromJwk(testWallet, "123"),
    });

    const balance = Number(data.winc);

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    expect(balance).to.equal(5000000);
  });

  it("GET /balance returns 404 for no user found", async function () {
    this.timeout(5_000);
    const jwk = await Arweave.crypto.generateJWK();

    const { status, statusText, data } = await axios.get(`/v1/balance`, {
      headers: await signedRequestHeadersFromJwk(jwk, "123"),
    });

    expect(status).to.equal(404);
    expect(statusText).to.equal("Not Found");

    expect(data).to.equal("User Not Found");
  });

  it("GET /balance returns 403 for bad signature", async () => {
    const { status, data, statusText } = await axios.get(`/v1/balance`, {
      headers: {
        ...(await signedRequestHeadersFromJwk(testWallet, "123")),
        "x-nonce": "a fake different nonce that will not match",
      },
    });

    expect(status).to.equal(403);
    expect(statusText).to.equal("Forbidden");

    expect(data).to.equal("Invalid signature or missing required headers");
  });

  it("GET /balance returns 503 when the database cannot be reached", async () => {
    stub(paymentDatabase, "getBalance").throws(Error("Whoops!"));
    const { status, data, statusText } = await axios.get(`/v1/balance`, {
      headers: await signedRequestHeadersFromJwk(testWallet),
    });

    expect(status).to.equal(503);
    expect(statusText).to.equal("Service Unavailable");
    expect(data).to.equal("Cloud Database Unavailable");
  });

  it("GET /top-up/checkout-session with an email in query params returns the correct response", async () => {
    const amount = 1000;
    const email = "test@example.inc";
    const checkoutStub = stub(stripe.checkout.sessions, "create").resolves(
      stripeResponseStub({
        ...checkoutSessionSuccessStub,
        amount_total: amount,
      })
    );

    const { status, statusText, data } = await axios.get(
      `/v1/top-up/checkout-session/${email}/usd/${amount}?destinationAddressType=email&giftMessage=hello%20world`
    );

    expect(data).to.have.property("topUpQuote");
    expect(data).to.have.property("paymentSession");
    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    const { paymentSession, topUpQuote, adjustments, fees } = data;
    const { object, payment_method_types, amount_total, url } = paymentSession;

    expect(object).to.equal("checkout.session");
    expect(payment_method_types).to.deep.equal(["card"]);
    expect(amount_total).to.equal(amount);
    expect(url).to.be.a.string;

    const {
      quotedPaymentAmount,
      paymentAmount,
      topUpQuoteId,
      destinationAddress,
      destinationAddressType,
      quoteExpirationDate,
    } = topUpQuote;

    expect(quotedPaymentAmount).to.equal(1000);
    expect(paymentAmount).to.equal(1000);
    expect(topUpQuoteId).to.be.a.string;
    expect(destinationAddress).to.equal(email);
    expect(destinationAddressType).to.equal("email");
    expect(quoteExpirationDate).to.be.a.string;

    expect(fees).to.deep.equal([
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
    expect(adjustments).to.deep.equal([]);

    const dbResult = await paymentDatabase["writer"]<TopUpQuoteDBResult>(
      tableNames.topUpQuote
    )
      .where({ top_up_quote_id: topUpQuoteId })
      .first();

    expect(dbResult).to.not.be.undefined;
    const {
      currency_type,
      top_up_quote_id,
      payment_provider,
      quoted_payment_amount,
      payment_amount,
      destination_address,
      destination_address_type,
      winston_credit_amount,
      quote_expiration_date,
      quote_creation_date,
      gift_message,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    } = dbResult!;

    expect(currency_type).to.equal("usd");
    expect(top_up_quote_id).to.be.a.string;
    expect(payment_provider).to.equal("stripe");
    expect(quoted_payment_amount).to.equal("1000");
    expect(payment_amount).to.equal("1000");
    expect(destination_address).to.equal(email);
    expect(destination_address_type).to.equal("email");
    expect(winston_credit_amount).to.equal("1091168091168");
    expect(new Date(quote_expiration_date).toISOString()).to.equal(
      quoteExpirationDate.toString()
    );
    expect(quote_creation_date).to.be.a.string;
    expect(gift_message).to.equal("hello world");

    checkoutStub.restore();
  });

  it("GET /top-up/checkout-session with an invalid destination address type returns 400 response", async () => {
    const { status, statusText, data } = await axios.get(
      `/v1/top-up/checkout-session/hello-test/usd/4231?destinationAddressType=notReal`
    );

    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
    expect(data).to.equal("Invalid destination address type: notReal");
  });

  it("GET /top-up/checkout-session returns 200 and correct response for correct signature", async () => {
    const amount = 1000;
    const checkoutStub = stub(stripe.checkout.sessions, "create").resolves(
      stripeResponseStub({
        ...checkoutSessionSuccessStub,
        amount_total: amount,
      })
    );

    const { status, statusText, data } = await axios.get(
      `/v1/top-up/checkout-session/${testAddress}/usd/${amount}`
    );

    expect(data).to.have.property("topUpQuote");
    expect(data).to.have.property("paymentSession");
    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    const { object, payment_method_types, amount_total, url } =
      data.paymentSession;

    expect(object).to.equal("checkout.session");
    expect(payment_method_types).to.deep.equal(["card"]);
    expect(amount_total).to.equal(amount);
    expect(url).to.be.a.string;
    checkoutStub.restore();
  });

  it("GET /top-up/payment-intent returns 200 and correct response for correct signature", async () => {
    const topUpAmount = 1000;
    const paymentIntentStubSpy = stub(stripe.paymentIntents, "create").resolves(
      stripeResponseStub({
        ...paymentIntentStub({
          amount: topUpAmount,
          status: "requires_payment_method",
        }),
      })
    );

    const { status, statusText, data } = await axios.get(
      `/v1/top-up/payment-intent/${testAddress}/usd/${topUpAmount}`
    );

    expect(data).to.have.property("topUpQuote");
    expect(data).to.have.property("paymentSession");
    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    const {
      object,
      payment_method_types,
      amount,
      currency,
      client_secret,
      metadata,
      status: paymentStatus,
    } = data.paymentSession;

    expect(object).to.equal("payment_intent");
    expect(payment_method_types).to.deep.equal(["card"]);
    expect(amount).to.equal(topUpAmount);
    expect(currency).to.equal("usd");
    expect(client_secret).to.be.a.string;
    expect(metadata.topUpQuoteId).to.be.a.string;
    expect(paymentStatus).to.equal("requires_payment_method");

    const {
      quotedPaymentAmount,
      paymentAmount,
      topUpQuoteId,
      winstonCreditAmount,
    }: TopUpQuote = data.topUpQuote;

    expect(quotedPaymentAmount).to.equal(1000);
    expect(paymentAmount).to.equal(1000);
    expect(topUpQuoteId).to.be.a.string;
    expect(winstonCreditAmount).to.equal("1091168091168");

    expect(data.fees).to.deep.equal([
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
    expect(data.adjustments).to.deep.equal([]);

    paymentIntentStubSpy.restore();
  });

  it("GET /top-up with promoCode in query params returns the expected result", async () => {
    const topUpAmount = 1000;
    const paymentIntentStubSpy = stub(stripe.paymentIntents, "create").resolves(
      stripeResponseStub({
        ...paymentIntentStub({
          amount: 800,
          status: "requires_payment_method",
        }),
      })
    );

    const { status, statusText, data } = await axiosPackage
      .create({
        baseURL: localTestUrl,
        validateStatus: () => true,
      })
      .get(
        `/v1/top-up/payment-intent/${testAddress}/usd/${topUpAmount}?promoCode=${routerTestPromoCode}`,
        {
          headers: await signedRequestHeadersFromJwk(testWallet, "123"),
        }
      );

    expect(data).to.have.property("topUpQuote");
    expect(data).to.have.property("paymentSession");
    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    const {
      object,
      payment_method_types,
      amount,
      currency,
      client_secret,
      status: paymentStatus,
      metadata,
    } = data.paymentSession;

    const {
      quotedPaymentAmount,
      paymentAmount,
      topUpQuoteId,
      winstonCreditAmount,
    }: TopUpQuote = data.topUpQuote;

    expect(object).to.equal("payment_intent");
    expect(payment_method_types).to.deep.equal(["card"]);
    expect(amount).to.equal(paymentAmount);
    expect(currency).to.equal("usd");
    expect(client_secret).to.be.a.string;
    expect(metadata.topUpQuoteId).to.be.a.string;
    expect(paymentStatus).to.equal("requires_payment_method");

    expect(quotedPaymentAmount).to.equal(1000);
    expect(paymentAmount).to.equal(800);
    expect(topUpQuoteId).to.be.a.string;
    expect(winstonCreditAmount).to.equal("1091168091168");

    expect(data.adjustments).to.deep.equal([
      {
        adjustmentAmount: -200,
        currencyType: "usd",
        description: "",
        name: "Router Test Promo Code",
        operator: "multiply",
        operatorMagnitude: 0.8,
        promoCode: "routerTestPromoCode",
      },
    ]);
    expect(data.fees).to.deep.equal([
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

    paymentIntentStubSpy.restore();
  });

  it("GET /top-up with INVALID promoCode in query params returns a 400", async () => {
    const { status, statusText, data } = await axiosPackage
      .create({
        baseURL: localTestUrl,
        validateStatus: () => true,
      })
      .get(
        `/v1/top-up/payment-intent/${testAddress}/usd/1000?promoCode=fakeCodeLOL`,
        {
          headers: await signedRequestHeadersFromJwk(testWallet, "123"),
        }
      );

    expect(data).to.equal("No promo code found with code 'fakeCodeLOL'");
    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
  });

  it("GET /top-up with INELIGIBLE promoCode in query params returns a 400", async () => {
    const jwk = await Arweave.crypto.generateJWK();
    const userAddress = arweaveRSAModulusToAddress(jwk.n);

    await dbTestHelper.insertStubPaymentReceipt({
      top_up_quote_id: "used promo code id",
      destination_address: userAddress,
      payment_receipt_id: "unique id promo ineligible top up",
    });
    await dbTestHelper.insertStubPaymentAdjustment({
      catalog_id: routerTestPromoCodeCatalogId,
      top_up_quote_id: "used promo code id",
      user_address: userAddress,
    });

    const { status, statusText, data } = await axiosPackage
      .create({
        baseURL: localTestUrl,
        validateStatus: () => true,
      })
      // This wallet just used this code above... So we should now fail
      .get(
        `/v1/top-up/payment-intent/${userAddress}/usd/1000?promoCode=${routerTestPromoCode}`,
        {
          headers: await signedRequestHeadersFromJwk(jwk, "123"),
        }
      );

    expect(data).to.equal(
      `The user '${userAddress}' is ineligible for the promo code '${routerTestPromoCode}'`
    );
    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
  });

  it("GET /top-up returns 403 for bad arweave address", async () => {
    const { status, statusText, data } = await axios.get(
      `/v1/top-up/checkout-session/BAD_ADDRESS_OF_DOOM/usd/100`
    );
    expect(status).to.equal(403);
    expect(data).to.equal(
      "Destination address is not a valid Arweave native address!"
    );
    expect(statusText).to.equal("Forbidden");
  });

  it("GET /top-up returns 400 for bad email address", async () => {
    const { status, statusText, data } = await axios.get(
      `/v1/top-up/checkout-session/THISisNotEmail/usd/100?destinationAddressType=email`
    );
    expect(status).to.equal(400);
    expect(data).to.equal("Destination address is not a valid email!");
    expect(statusText).to.equal("Bad Request");
  });

  it("GET /top-up returns 400 for invalid payment method", async () => {
    const { status, data, statusText } = await axios.get(
      `/v1/top-up/some-method/${testAddress}/usd/101`
    );

    expect(data).to.equal(
      "Payment method must include one of: payment-intent,checkout-session!"
    );
    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
  });

  it("GET /top-up returns 400 for invalid currency", async () => {
    const { status, data, statusText } = await axios.get(
      `/v1/top-up/payment-intent/${testAddress}/currencyThatDoesNotExist/100`
    );

    expect(data).to.equal(
      // cspell:disable
      "The currency type 'currencythatdoesnotexist' is currently not supported by this API!"
      // cspell:enable
    );
    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
  });

  it("GET /top-up returns 400 for invalid payment amount", async () => {
    const { status, data, statusText } = await axios.get(
      `/v1/top-up/checkout-session/${testAddress}/usd/-984`
    );

    expect(data).to.equal(
      "The provided payment amount (-984) is invalid; it must be a positive non-decimal integer!"
    );
    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
  });

  it("GET /top-up returns 502 when fiat pricing oracle is unreachable", async () => {
    stub(pricingService, "getWCForPayment").throws(Error("Oh no!"));
    const { status, data, statusText } = await axios.get(
      `/v1/top-up/checkout-session/${testAddress}/usd/1337`
    );

    expect(data).to.equal("Fiat Oracle Unavailable");
    expect(status).to.equal(502);
    expect(statusText).to.equal("Bad Gateway");
  });

  // Ensure that we can handle all of our own exposed currency limitations
  describe("currency limitation tests", () => {
    let currencyLimitations: CurrencyLimitations;
    before(async () => {
      currencyLimitations = (await axios.get(`v1/currencies`)).data.limits;
    });

    it("GET /top-up returns 200 for max and min payment amounts for each currency", async () => {
      const checkoutSessionStubSpy = stub(
        stripe.checkout.sessions,
        "create"
      ).resolves(stripeResponseStub(checkoutSessionStub({})));

      // Get maximum price for each supported currency concurrently
      const maxPriceResponses = await Promise.all(
        supportedPaymentCurrencyTypes.map((currencyType) =>
          axios.get(
            `/v1/top-up/checkout-session/${testAddress}/${currencyType}/${currencyLimitations[currencyType].maximumPaymentAmount}`
          )
        )
      );
      for (const res of maxPriceResponses) {
        expect(res.status).to.equal(200);
      }

      // Get minimum price for each supported currency concurrently
      const minPriceResponses = await Promise.all(
        supportedPaymentCurrencyTypes.map((currencyType) =>
          axios.get(
            `/v1/top-up/checkout-session/${testAddress}/${currencyType}/${currencyLimitations[currencyType].minimumPaymentAmount}`
          )
        )
      );
      for (const { status } of minPriceResponses) {
        expect(status).to.equal(200);
      }
      checkoutSessionStubSpy.restore();
    });

    it("GET /top-up returns 400 for a payment amount too large in each supported currency", async () => {
      for (const currencyType of supportedPaymentCurrencyTypes) {
        const maxAmountAllowed =
          currencyLimitations[currencyType].maximumPaymentAmount;

        const { data, status, statusText } = await axios.get(
          `/v1/top-up/checkout-session/${testAddress}/${currencyType}/${
            maxAmountAllowed + 1
          }`
        );

        expect(data).to.equal(
          `The provided payment amount (${
            maxAmountAllowed + 1
          }) is too large for the currency type "${currencyType}"; it must be below or equal to ${maxAmountAllowed}!`
        );
        expect(status).to.equal(400);
        expect(statusText).to.equal("Bad Request");
      }
    });

    it("GET /top-up returns 400 for a payment amount too small in each supported currency", async () => {
      for (const currencyType of supportedPaymentCurrencyTypes) {
        const minAmountAllowed =
          currencyLimitations[currencyType].minimumPaymentAmount;

        const { data, status, statusText } = await axios.get(
          `/v1/top-up/checkout-session/${testAddress}/${currencyType}/${
            minAmountAllowed - 1
          }`
        );

        expect(data).to.equal(
          `The provided payment amount (${
            minAmountAllowed - 1
          }) is too small for the currency type "${currencyType}"; it must be above ${minAmountAllowed}!`
        );
        expect(status).to.equal(400);
        expect(statusText).to.equal("Bad Request");
      }
    });
  });

  it("GET /top-up returns 502 when stripe fails to create payment session", async () => {
    const checkoutStub = stub(stripe.checkout.sessions, "create").throws(
      Error("Oh no!")
    );
    const { status, data, statusText } = await axios.get(
      `/v1/top-up/checkout-session/${testAddress}/usd/1337`
    );

    expect(data).to.equal(
      "Error creating stripe payment session with method: checkout-session!"
    );
    expect(status).to.equal(502);
    expect(statusText).to.equal("Bad Gateway");
    checkoutStub.restore();
  });

  it("GET /top-up returns 503 when database is unreachable", async () => {
    stub(stripe.checkout.sessions, "create").resolves(
      stripeResponseStub(checkoutSessionStub({}))
    );
    stub(paymentDatabase, "createTopUpQuote").throws(Error("Bad news"));
    const { status, data, statusText } = await axios.get(
      `/v1/top-up/checkout-session/${testAddress}/usd/1337`
    );

    expect(data).to.equal("Cloud Database Unavailable");
    expect(status).to.equal(503);
    expect(statusText).to.equal("Service Unavailable");
  });

  it("GET /reserve-balance returns 200 for correct params", async () => {
    const testAddress = "a stub address";
    await dbTestHelper.insertStubUser({
      user_address: testAddress,
      winston_credit_balance: "1000000000",
    });

    const byteCount = 1;
    const token = sign({}, TEST_PRIVATE_ROUTE_SECRET, {
      expiresIn: "1h",
    });

    const adjustedWincTotal = new Winston("100");
    stub(pricingService, "getWCForBytes").resolves({
      finalPrice: new FinalPrice(adjustedWincTotal),
      networkPrice: new NetworkPrice(adjustedWincTotal),
      adjustments: [],
    });

    const { status, statusText, data } = await axios.get(
      `/v1/reserve-balance/${testAddress}?byteCount=${byteCount}&dataItemId=${stubTxId2}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(statusText).to.equal("Balance reserved");
    expect(status).to.equal(200);
    expect(data).to.equal("100");
  });

  it("GET /reserve-balance returns 400 for legacy route without a data item ID", async () => {
    const testAddress = "a stub address 2";
    await dbTestHelper.insertStubUser({
      user_address: testAddress,
      winston_credit_balance: "1000000000",
    });

    const byteCount = 1;
    const token = sign({}, TEST_PRIVATE_ROUTE_SECRET, {
      expiresIn: "1h",
    });

    const wincTotal = new Winston("100");
    stub(pricingService, "getWCForBytes").resolves({
      finalPrice: new FinalPrice(wincTotal),
      networkPrice: new NetworkPrice(wincTotal),
      adjustments: [],
    });

    const { status, statusText, data } = await axios.get(
      `/v1/reserve-balance/${testAddress}/${byteCount}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(statusText).to.equal("Bad Request");
    expect(status).to.equal(400);
    expect(data).to.equal("Invalid or missing parameters");
  });

  it("GET /reserve-balance returns 401 for missing authorization", async () => {
    const byteCount = 1000;

    const { status, statusText } = await axios.get(
      `/v1/reserve-balance/${testAddress}?byteCount=${byteCount}&dataItemId=${stubTxId1}`
    );
    expect(statusText).to.equal("Unauthorized");
    expect(status).to.equal(401);
  });

  it("GET /reserve-balance returns 402 for insufficient balance", async () => {
    const byteCount = 100000;
    const token = sign({}, TEST_PRIVATE_ROUTE_SECRET, {
      expiresIn: "1h",
    });

    const { status, statusText } = await axios.get(
      `/v1/reserve-balance/${testAddress}?byteCount=${byteCount}&dataItemId=${stubTxId1}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(statusText).to.equal("Insufficient balance");
    expect(status).to.equal(402);
  });

  it("GET /reserve-balance returns 404 if user not found", async () => {
    const testAddress = "someRandomAddress";
    const byteCount = 100000;

    const token = sign({}, TEST_PRIVATE_ROUTE_SECRET, {
      expiresIn: "1h",
    });

    const { status, statusText } = await axios.get(
      `/v1/reserve-balance/${testAddress}?byteCount=${byteCount}&dataItemId=${stubTxId1}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(statusText).to.equal("User not found");
    expect(status).to.equal(404);
  });

  it("GET /check-balance returns 200 for correct params", async () => {
    const testAddress = "a unique new stub address";
    await dbTestHelper.insertStubUser({
      user_address: testAddress,
      winston_credit_balance: "1000000000",
    });

    const byteCount = 1;
    const token = sign({}, TEST_PRIVATE_ROUTE_SECRET, {
      expiresIn: "1h",
    });

    const adjustedWincTotal = new Winston("100");
    stub(pricingService, "getWCForBytes").resolves({
      finalPrice: new FinalPrice(adjustedWincTotal),
      networkPrice: new NetworkPrice(adjustedWincTotal),
      adjustments: [],
    });

    const { status, statusText, data } = await axios.get(
      `/v1/check-balance/${testAddress}?byteCount=${byteCount}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(statusText).to.equal("User has sufficient balance");
    expect(status).to.equal(200);
    expect(data).to.deep.equal({
      userHasSufficientBalance: true,
      bytesCostInWinc: "100",
      userBalanceInWinc: "1000000000",
      adjustments: [],
    });
  });

  it("GET /check-balance returns 401 for missing authorization", async () => {
    const byteCount = 1000;

    const { status, statusText } = await axios.get(
      `/v1/check-balance/${testAddress}?byteCount=${byteCount}`
    );
    expect(statusText).to.equal("Unauthorized");
    expect(status).to.equal(401);
  });

  it("GET /check-balance returns 402 for insufficient balance", async () => {
    const byteCount = 10000000;
    const token = sign({}, TEST_PRIVATE_ROUTE_SECRET, {
      expiresIn: "1h",
    });

    const { status, statusText } = await axios.get(
      `/v1/check-balance/${testAddress}?byteCount=${byteCount}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(statusText).to.equal("Insufficient balance");
    expect(status).to.equal(402);
  });

  it("GET /check-balance returns 404 if user not found", async () => {
    const testAddress = "someRandomAddress";
    const byteCount = 100000;

    const token = sign({}, TEST_PRIVATE_ROUTE_SECRET, {
      expiresIn: "1h",
    });

    const { status, statusText } = await axios.get(
      `/v1/check-balance/${testAddress}?byteCount=${byteCount}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(statusText).to.equal("User not found");
    expect(status).to.equal(404);
  });

  it("GET /refund-balance returns 200 for correct params", async () => {
    const winstonCredits = 1000;
    const token = sign({}, TEST_PRIVATE_ROUTE_SECRET, {
      expiresIn: "1h",
    });

    const { status, statusText } = await axios.get(
      `/v1/refund-balance/${testAddress}?winstonCredits=${winstonCredits}&dataItemId=${stubTxId1}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(statusText).to.equal("Balance refunded");
    expect(status).to.equal(200);
  });

  it("GET /refund-balance returns 401 for missing authorization", async () => {
    const winstonCredits = 1000;

    const { status, statusText } = await axios.get(
      `/v1/refund-balance/${testAddress}?winstonCredits=${winstonCredits}&dataItemId=${stubTxId1}`
    );
    expect(statusText).to.equal("Unauthorized");
    expect(status).to.equal(401);
  });

  it("GET /refund-balance returns 404 if user not found", async () => {
    const testAddress = "someRandomAddress";
    const winstonCredits = 100000;
    const token = sign({}, TEST_PRIVATE_ROUTE_SECRET, {
      expiresIn: "1h",
    });

    const { status, statusText } = await axios.get(
      `/v1/refund-balance/${testAddress}?winstonCredits=${winstonCredits}&dataItemId=${stubTxId1}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    expect(statusText).to.equal("User not found");
    expect(status).to.equal(404);
  });

  it("GET /currencies returns status 200 and the expected list of currencies and limits", async () => {
    const { status, statusText, data } = await axios.get(`/v1/currencies`);

    expect(data.supportedCurrencies).to.deep.equal(
      supportedPaymentCurrencyTypes
    );
    expect(data.limits).to.exist;
    expect(statusText).to.equal("OK");
    expect(status).to.equal(200);
  });

  // We expect to return 200 OK on all stripe webhook events we handle regardless of how we handle the event
  it("POST /stripe-webhook returns 200 for valid stripe dispute event", async () => {
    const disputeEventPaymentReceiptId = "A Payment Receipt Id to Dispute 👊🏻";
    const disputeEventUserAddress = "User Address to Dispute 🤺";
    const topUpQuoteId = "0x1234567890";
    const paymentIntent = paymentIntentStub({
      metadata: {
        disputeEventUserAddress,
        topUpQuoteId,
      },
    });
    const dispute = chargeDisputeStub({
      paymentIntent: paymentIntent.id,
    });

    const paymentIntentResponse: Stripe.Response<Stripe.PaymentIntent> = {
      ...paymentIntent,
      lastResponse: {
        headers: {},
        requestId: "test-response",
        statusCode: 200,
      },
    };

    const paymentIntentResponseStub = stub(
      stripe.paymentIntents,
      "retrieve"
    ).resolves(paymentIntentResponse);

    // Insert payment receipt and user that dispute event depends on
    await dbTestHelper.insertStubUser({
      user_address: disputeEventUserAddress,
      winston_credit_balance: "1000",
    });

    await dbTestHelper.insertStubPaymentReceipt({
      payment_receipt_id: disputeEventPaymentReceiptId,
      winston_credit_amount: "50",
      top_up_quote_id: topUpQuoteId,
      destination_address: disputeEventUserAddress,
    });

    const stubEvent = stripeStubEvent({
      type: "charge.dispute.created",
      eventObject: dispute,
    });

    const eventStub = stub(stripe.webhooks, "constructEvent").returns(
      stubEvent
    );

    const { status, statusText, data } = await axios.post(`/v1/stripe-webhook`);

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");
    expect(data).to.equal("OK");

    // wait a few seconds for the database to update since we return the response right away
    await new Promise((resolve) => setTimeout(resolve, 500));

    const chargebackReceipt = await paymentDatabase[
      "reader"
    ]<ChargebackReceiptDBResult>(tableNames.chargebackReceipt).where({
      payment_receipt_id: disputeEventPaymentReceiptId,
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
    expect(destination_address).to.equal(disputeEventUserAddress);
    expect(destination_address_type).to.equal("arweave");
    expect(payment_provider).to.equal("stripe");
    expect(chargeback_receipt_date).to.exist;
    expect(chargeback_receipt_id).to.exist;
    expect(payment_receipt_id).to.equal(disputeEventPaymentReceiptId);
    expect(winston_credit_amount).to.equal("50");
    expect(chargeback_reason).to.equal("fraudulent");

    const user = await paymentDatabase["reader"]<UserDBResult>(
      tableNames.user
    ).where({
      user_address: disputeEventUserAddress,
    });

    expect(user[0].winston_credit_balance).to.equal("950");

    eventStub.restore();
    paymentIntentResponseStub.restore();
  });

  it("POST /stripe-webhook returns 200 for valid stripe payment success event", async () => {
    const paymentReceivedEventId = "A Payment Receipt Id";
    const paymentReceivedUserAddress = "User Address credited payment";
    const paymentSuccessTopUpQuoteId = "0x0987654321";

    await dbTestHelper.insertStubUser({
      user_address: paymentReceivedUserAddress,
      winston_credit_balance: "0",
    });

    await dbTestHelper.insertStubTopUpQuote({
      top_up_quote_id: paymentSuccessTopUpQuoteId,
      winston_credit_amount: "500",
      payment_amount: "100",
      quoted_payment_amount: "100",
      destination_address: paymentReceivedUserAddress,
    });

    const successStub = paymentIntentStub({
      id: paymentReceivedEventId,
      metadata: {
        topUpQuoteId: paymentSuccessTopUpQuoteId,
      },
      amount: 100,
      currency: "usd",
    });

    const stubEvent = stripeStubEvent({
      type: "payment_intent.succeeded",
      eventObject: successStub,
    });

    const webhookStub = stub(stripe.webhooks, "constructEvent").returns(
      stubEvent
    );

    const { status, statusText, data } = await axios.post(`/v1/stripe-webhook`);

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");
    expect(data).to.equal("OK");

    // wait a few seconds for the database to update since we return the response right away
    await new Promise((resolve) => setTimeout(resolve, 500));

    const paymentReceipt = await paymentDatabase[
      "reader"
    ]<PaymentReceiptDBResult>(tableNames.paymentReceipt).where({
      top_up_quote_id: paymentSuccessTopUpQuoteId,
    });
    expect(paymentReceipt.length).to.equal(1);

    const {
      payment_amount,
      quoted_payment_amount,
      currency_type,
      destination_address,
      destination_address_type,
      payment_provider,
    } = paymentReceipt[0];

    expect(payment_amount).to.equal("100");
    expect(quoted_payment_amount).to.equal("100");
    expect(currency_type).to.equal("usd");
    expect(destination_address).to.equal(paymentReceivedUserAddress);
    expect(destination_address_type).to.equal("arweave");
    expect(payment_provider).to.equal("stripe");

    const user = await paymentDatabase["reader"]<UserDBResult>(
      tableNames.user
    ).where({
      user_address: paymentReceivedUserAddress,
    });
    expect(user[0].winston_credit_balance).to.equal("500");

    webhookStub.restore();
  });

  it("POST /stripe-webhook returns 200 for valid stripe payment success event resulting in an unredeemed gift and the database contains the correct payment receipt and unredeemed gift entities", async () => {
    stub(emailProvider, "sendEmail").resolves();

    const paymentReceivedEventId = "A Unique ID!!!";
    const testEmailAddress = "test@example.inc";
    const paymentSuccessTopUpQuoteId = "0x0987654321091";

    await dbTestHelper.insertStubTopUpQuote({
      top_up_quote_id: paymentSuccessTopUpQuoteId,
      winston_credit_amount: "500",
      payment_amount: "100",
      quoted_payment_amount: "100",
      destination_address: testEmailAddress,
      destination_address_type: "email",
      gift_message: "A gift message",
    });

    const successStub = paymentIntentStub({
      id: paymentReceivedEventId,
      metadata: {
        topUpQuoteId: paymentSuccessTopUpQuoteId,
      },
      amount: 100,
      currency: "usd",
    });

    const stubEvent = stripeStubEvent({
      type: "payment_intent.succeeded",
      eventObject: successStub,
    });

    const webhookStub = stub(stripe.webhooks, "constructEvent").returns(
      stubEvent
    );

    const { status, statusText, data } = await axios.post(`/v1/stripe-webhook`);

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");
    expect(data).to.equal("OK");

    // wait a few seconds for the database to update since we return the response right away
    await new Promise((resolve) => setTimeout(resolve, 500));

    const paymentReceipt = await paymentDatabase[
      "writer"
    ]<PaymentReceiptDBResult>(tableNames.paymentReceipt).where({
      top_up_quote_id: paymentSuccessTopUpQuoteId,
    });
    expect(paymentReceipt.length).to.equal(1);

    const {
      payment_amount,
      quoted_payment_amount,
      currency_type,
      destination_address,
      destination_address_type,
      payment_provider,
    } = paymentReceipt[0];

    expect(payment_amount).to.equal("100");
    expect(quoted_payment_amount).to.equal("100");
    expect(currency_type).to.equal("usd");
    expect(destination_address).to.equal(testEmailAddress);
    expect(destination_address_type).to.equal("email");
    expect(payment_provider).to.equal("stripe");

    const gift = await paymentDatabase["writer"]<UnredeemedGiftDBResult>(
      tableNames.unredeemedGift
    ).where({
      payment_receipt_id: paymentReceipt[0].payment_receipt_id,
    });
    expect(gift.length).to.equal(1);

    const {
      creation_date,
      expiration_date,
      gifted_winc_amount,
      payment_receipt_id,
      recipient_email,
      gift_message,
    } = gift[0];

    expect(creation_date).to.exist;
    // expect expiration to be gift creation plus 1 year
    expect(new Date(expiration_date).toISOString()).to.equal(
      new Date(
        new Date(creation_date).setFullYear(
          new Date(creation_date).getFullYear() + 1
        )
      ).toISOString()
    );
    expect(gifted_winc_amount).to.equal("500");
    expect(payment_receipt_id).to.equal(paymentReceipt[0].payment_receipt_id);
    expect(recipient_email).to.equal(testEmailAddress);
    expect(gift_message).to.equal("A gift message");

    webhookStub.restore();
  });

  it("POST /stripe-webhook returns 400 for invalid stripe requests", async () => {
    stub(stripe.webhooks, "constructEvent").throws(Error("bad"));

    const { status, statusText, data } = await axios.post(`/v1/stripe-webhook`);

    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
    expect(data).to.equal("Webhook Error!");
  });

  it("GET /rates returns 502 if unable to fetch prices", async () => {
    stub(pricingService, "getWCForBytes").throws(Error("Serious failure"));

    const { status, statusText } = await axios.get(`/v1/rates`);

    expect(status).to.equal(502);
    expect(statusText).to.equal("Bad Gateway");
  });

  it("GET /redeem returns 200 for valid params", async () => {
    const destinationAddress = "validArweaveAddressNeedsFortyThreeCharacter";
    const paymentReceiptId = "unique paymentReceiptId";
    const emailAddress = "test@example.inc";
    const giftMessage = "hello the world!";

    const paymentReceiptDBInsert: PaymentReceiptDBInsert = {
      top_up_quote_id: "required top up id",
      payment_receipt_id: paymentReceiptId,
      payment_amount: "100",
      quoted_payment_amount: "100",
      currency_type: "email",
      destination_address: emailAddress,
      destination_address_type: "arweave",
      payment_provider: "stripe",
      quote_creation_date: oneHourAgo,
      quote_expiration_date: oneHourFromNow,
      winston_credit_amount: "100",
      gift_message: giftMessage,
    };
    await paymentDatabase["writer"]<PaymentReceiptDBResult>(
      tableNames.paymentReceipt
    ).insert(paymentReceiptDBInsert);
    const unredeemedGiftDbInsert: UnredeemedGiftDBInsert = {
      gifted_winc_amount: "100",
      payment_receipt_id: paymentReceiptId,
      recipient_email: emailAddress,
      gift_message: giftMessage,
    };
    await paymentDatabase["writer"]<UnredeemedGiftDBResult>(
      tableNames.unredeemedGift
    ).insert(unredeemedGiftDbInsert);

    const { status, statusText, data } = await axios.get(
      `/v1/redeem?destinationAddress=${destinationAddress}&id=${paymentReceiptId}&email=${emailAddress}`
    );

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    const { message, userBalance, userAddress, userCreationDate } = data;
    expect(message).to.equal("Payment receipt redeemed for 100 winc!");
    expect(userBalance).to.equal("100");
    expect(userAddress).to.equal(destinationAddress);
    expect(userCreationDate).to.exist;

    const userDbResult = await paymentDatabase["reader"]<UserDBResult>(
      tableNames.user
    ).where({
      user_address: destinationAddress,
    });
    expect(userDbResult.length).to.equal(1);
    expect(userDbResult[0].winston_credit_balance).to.equal("100");

    const unredeemedGiftDbResult = await paymentDatabase[
      "reader"
    ]<UnredeemedGiftDBResult>(tableNames.unredeemedGift).where({
      payment_receipt_id: paymentReceiptId,
    });
    expect(unredeemedGiftDbResult.length).to.equal(0);

    const redeemedGiftDbResult = await paymentDatabase[
      "reader"
    ]<RedeemedGiftDBResult>(tableNames.redeemedGift).where({
      payment_receipt_id: paymentReceiptId,
    });
    expect(redeemedGiftDbResult.length).to.equal(1);

    const {
      payment_receipt_id,
      recipient_email,
      gift_message,
      creation_date,
      destination_address,
      expiration_date,
      gifted_winc_amount,
      redemption_date,
    } = redeemedGiftDbResult[0];

    expect(payment_receipt_id).to.equal(paymentReceiptId);
    expect(recipient_email).to.equal(emailAddress);
    expect(gift_message).to.equal(giftMessage);
    expect(creation_date).to.exist;
    expect(destination_address).to.equal(destinationAddress);
    expect(expiration_date).to.exist;
    expect(gifted_winc_amount).to.equal("100");
    expect(redemption_date).to.exist;
  });

  it("GET /redeem returns 400 for invalid email", async () => {
    const destinationAddress = "validArweaveAddressNeedsFortyThreeCharacter";
    const paymentReceiptId = "unique paymentReceiptId 21e12";
    const emailAddress = "invalid email";

    const { status, statusText, data } = await axios.get(
      `/v1/redeem?destinationAddress=${destinationAddress}&id=${paymentReceiptId}&email=${emailAddress}`
    );

    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
    expect(data).to.equal(
      "Provided recipient email address is not a valid email!"
    );
  });

  it("GET /redeem returns 400 for invalid destination address", async () => {
    const destinationAddress = "invalidArweaveAddressNeedsFortyThreeCharacter";
    const paymentReceiptId = "unique das paymentReceiptId 21e12";
    const emailAddress = "fake@example.inc";

    const { status, statusText, data } = await axios.get(
      `/v1/redeem?destinationAddress=${destinationAddress}&id=${paymentReceiptId}&email=${emailAddress}`
    );

    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
    expect(data).to.equal(
      "Provided destination address is not a valid Arweave native address!"
    );
  });

  it("GET /redeem returns 400 for non matching recipient email", async () => {
    const destinationAddress = "validArweaveAddressNeedsFortyThreeCharacter";
    const paymentReceiptId = "unique paymentReceiptId 231";
    const emailAddress = "fake@inc.com";

    const paymentReceiptDBInsert: PaymentReceiptDBInsert = {
      top_up_quote_id: "required top up id!",
      payment_receipt_id: paymentReceiptId,
      payment_amount: "100",
      quoted_payment_amount: "100",
      currency_type: "email",
      destination_address: emailAddress,
      destination_address_type: "arweave",
      payment_provider: "stripe",
      quote_creation_date: oneHourAgo,
      quote_expiration_date: oneHourFromNow,
      winston_credit_amount: "100",
      gift_message: "A gift message",
    };
    await paymentDatabase["writer"]<PaymentReceiptDBResult>(
      tableNames.paymentReceipt
    ).insert(paymentReceiptDBInsert);

    const unredeemedGiftDbInsert: UnredeemedGiftDBInsert = {
      gifted_winc_amount: "100",
      payment_receipt_id: paymentReceiptId,
      recipient_email: emailAddress,
      gift_message: "A gift message",
    };
    await paymentDatabase["writer"]<UnredeemedGiftDBResult>(
      tableNames.unredeemedGift
    ).insert(unredeemedGiftDbInsert);

    const { status, statusText, data } = await axios.get(
      `/v1/redeem?destinationAddress=${destinationAddress}&id=${paymentReceiptId}&email=wrong@email.test`
    );

    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
    expect(data).to.equal("Failure to redeem payment receipt!");
  });

  it("GET /redeem returns 400 for not found payment receipt id", async () => {
    const destinationAddress = "validArweaveAddressNeedsFortyThreeCharacter";
    const paymentReceiptId = "unique paymentReceiptId 221";
    const emailAddress = "fake@unique.inc";

    const { status, statusText, data } = await axios.get(
      `/v1/redeem?destinationAddress=${destinationAddress}&id=${paymentReceiptId}&email=${emailAddress}`
    );

    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
    expect(data).to.equal("Failure to redeem payment receipt!");
  });

  it("GET /redeem returns 503 for unexpected database error", async () => {
    const destinationAddress = "validArweaveAddressNeedsFortyThreeCharacter";
    const paymentReceiptId = "unique paymentReceiptId 141";
    const emailAddress = "fake@unique.inc";

    stub(paymentDatabase, "redeemGift").throws();

    const { status, statusText, data } = await axios.get(
      `/v1/redeem?destinationAddress=${destinationAddress}&id=${paymentReceiptId}&email=${emailAddress}`
    );

    expect(status).to.equal(503);
    expect(statusText).to.equal("Service Unavailable");
    expect(data).to.equal(
      "Error while redeeming payment receipt. Unable to reach Database!"
    );
  });
});

describe("Caching behavior tests", () => {
  let server: Server;

  const coinGeckoOracle = new CoingeckoArweaveToFiatOracle();
  const arweaveToFiatOracle = new ReadThroughArweaveToFiatOracle({
    oracle: coinGeckoOracle,
  });
  const pricingService = new TurboPricingService({ arweaveToFiatOracle });

  function closeServer() {
    server.close();
    logger.info("Server closed!");
  }

  before(async () => {
    server = await createServer({ pricingService, stripe });
  });

  after(() => {
    closeServer();
  });

  it("GET /price/:currency/:value only calls the oracle once for many subsequent price calls", async () => {
    const coinGeckoStub = stub(
      coinGeckoOracle,
      "getFiatPricesForOneAR"
    ).resolves(expectedArPrices.arweave);

    const pricingSpy = spy(pricingService, "getWCForPayment");

    // Get ten USD prices concurrently
    await Promise.all([
      axios.get(`/v1/price/USD/1000`),
      axios.get(`/v1/price/USD/10000`),
      axios.get(`/v1/price/USD/100000`),
      axios.get(`/v1/price/USD/1000000`),
      axios.get(`/v1/price/USD/500000`),
      axios.get(`/v1/price/USD/250000`),
      axios.get(`/v1/price/USD/125000`),
      axios.get(`/v1/price/USD/62500`),
      axios.get(`/v1/price/USD/31250`),
      axios.get(`/v1/price/USD/15625`),
    ]);

    // Get maximum price for each supported currency concurrently
    await Promise.all(
      supportedPaymentCurrencyTypes.map((currencyType) =>
        axios.get(
          `/v1/price/${currencyType}/${paymentAmountLimits[currencyType].maximumPaymentAmount}`
        )
      )
    );

    // Get minimum price for each supported currency concurrently
    await Promise.all(
      supportedPaymentCurrencyTypes.map((currencyType) =>
        axios.get(
          `/v1/price/${currencyType}/${paymentAmountLimits[currencyType].minimumPaymentAmount}`
        )
      )
    );

    // We expect the pricing service spy to be called 10 times and twice for each supported currencies
    expect(pricingSpy.callCount).to.equal(
      10 + supportedPaymentCurrencyTypes.length * 2
    );

    // But the CoinGecko oracle is only called the one time
    expect(coinGeckoStub.calledOnce).to.be.true;
  });
});
