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
import { ARIOToken, mARIOToken } from "@ar.io/sdk";
import Arweave from "arweave/node/common";
import axiosPackage from "axios";
import BigNumber from "bignumber.js";
import { expect } from "chai";
import { Server } from "http";
import { sign } from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { spy, stub, useFakeTimers } from "sinon";
import Stripe from "stripe";

import {
  CurrencyLimitations,
  TEST_PRIVATE_ROUTE_SECRET,
  paymentAmountLimits,
} from "../src/constants";
import { tableNames } from "../src/database/dbConstants";
import {
  ArNSPurchaseDBResult,
  ChargebackReceiptDBResult,
  DelegatedPaymentApproval,
  PaymentReceiptDBInsert,
  PaymentReceiptDBResult,
  RedeemedGiftDBResult,
  SingleUseCodePaymentCatalogDBResult,
  TopUpQuote,
  TopUpQuoteDBResult,
  UnredeemedGiftDBInsert,
  UnredeemedGiftDBResult,
  UploadAdjustmentCatalogDBInsert,
  UploadAdjustmentCatalogDBResult,
  UploadAdjustmentDBInsert,
  UserDBResult,
  userAddressTypes,
} from "../src/database/dbTypes";
import { PaymentTransactionNotFound } from "../src/database/errors";
import logger from "../src/logger";
import {
  CoingeckoTokenToFiatOracle,
  ReadThroughTokenToFiatOracle,
  tokenNameToCoinGeckoTokenName,
} from "../src/pricing/oracles/tokenToFiatOracle";
import { FinalPrice, NetworkPrice } from "../src/pricing/price";
import {
  TurboPricingService,
  baseAmountToTokenAmount,
} from "../src/pricing/pricing";
import { walletAddresses } from "../src/routes/info";
import { createServer } from "../src/server";
import { supportedFiatPaymentCurrencyTypes } from "../src/types/supportedCurrencies";
import { W, Winston } from "../src/types/winston";
import { filterKeysFromObject } from "../src/utils/common";
import { arweaveRSAModulusToAddress } from "../src/utils/jwkUtils";
import {
  signedRequestHeadersFromEthWallet,
  signedRequestHeadersFromJwk,
} from "../tests/helpers/signData";
import {
  oneHourAgo,
  oneHourFromNow,
  randomCharString,
  stubArweaveUserAddress,
} from "./dbTestHelper";
import {
  chargeDisputeStub,
  checkoutSessionStub,
  checkoutSessionSuccessStub,
  expectedTokenPrices,
  paymentIntentStub,
  stripeResponseStub,
  stripeStubEvent,
  stubTxId1,
  stubTxId2,
} from "./helpers/stubs";
import { assertExpectedHeadersWithContentLength } from "./helpers/testExpectations";
import {
  arweaveOracle,
  axios,
  coinGeckoOracle,
  dbTestHelper,
  emailProvider,
  gatewayMap,
  localTestUrl,
  paymentDatabase,
  pricingService,
  stripe,
  testAddress,
  testArweaveWallet,
  testEthereumWallet,
} from "./helpers/testHelpers";

describe("Router tests", () => {
  let server: Server;

  function closeServer() {
    server.close();
    logger.info("Server closed!");
  }

  const routerTestPromoCode = "routerTestPromoCode";
  const routerTestPromoCodeCatalogId = "routerTestPromoCodeCatalogId";

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${sign({}, TEST_PRIVATE_ROUTE_SECRET)}`,
    },
  } as const;

  beforeEach(() => {
    stub(coinGeckoOracle, "getFiatPricesForOneToken").resolves(
      expectedTokenPrices
    );
    stub(arweaveOracle, "getWinstonForBytes").resolves(W(857_922_282_166));
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
      gatewayMap,
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

    const uploadAdjustmentCatalogDbInsert: UploadAdjustmentCatalogDBInsert = {
      catalog_id: randomUUID(),
      adjustment_name: "PDS Limited Subsidy Event",
      adjustment_description:
        "Free Uploads Under 105 KiB, Limited to 1 credit subsidized per Day",
      adjustment_priority: 550,
      operator: "multiply",
      operator_magnitude: "0",
      byte_count_threshold: "107520", // 105 KiB
      winc_limitation: "1000000000000", // 1 credit
      limitation_interval: "24", // 24 hours
      limitation_interval_unit: "hour", // 24 hours
    };

    await paymentDatabase["writer"](tableNames.uploadAdjustmentCatalog).insert(
      uploadAdjustmentCatalogDbInsert
    );
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
      deprecatedChunkBasedNetworkPrice: new NetworkPrice(wincTotal),
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
      deprecatedChunkBasedNetworkPrice: new NetworkPrice(wincTotal),
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

  it("GET /price/arweave/:bytes returns 503 if bytes pricing oracle fails to get a price", async () => {
    stub(pricingService, "getWCForBytes").throws(Error("Serious failure"));
    const { status, statusText, data } = await axios.get(
      `/price/arweave/1321321`
    );
    expect(status).to.equal(503);
    expect(data).to.equal("Pricing Oracle Unavailable");
    expect(statusText).to.equal("Service Unavailable");
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

  it("GET /price/bytes returns 503 if bytes pricing oracle fails to get a price", async () => {
    stub(pricingService, "getWCForBytes").throws(Error("Serious failure"));
    const { status, statusText, data } = await axios.get(
      `/v1/price/bytes/1321321`
    );
    expect(status).to.equal(503);
    expect(data).to.equal("Pricing Oracle Unavailable");
    expect(statusText).to.equal("Service Unavailable");
  });

  it("GET /price/:currency/:value returns 503 if fiat pricing oracle response is unexpected", async () => {
    stub(pricingService, "getWCForPayment").throws();
    const { data, status, statusText } = await axios.get(`/v1/price/usd/5000`);

    expect(status).to.equal(503);
    expect(statusText).to.equal("Service Unavailable");
    expect(data).to.equal("Fiat Oracle Unavailable");
  });

  it("GET /rates returns 503 if unable to fetch prices", async () => {
    stub(pricingService, "getWCForBytes").throws(Error("Serious failure"));

    const { status, statusText } = await axios.get(`/v1/rates`);

    expect(status).to.equal(503);
    expect(statusText).to.equal("Service Unavailable");
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
        aud: 0.888807484328,
        brl: 2.978706163694,
        cad: 0.805589022957,
        eur: 0.548212338306,
        gbp: 0.477004788886,
        hkd: 4.717714629652,
        inr: 49.350263437264,
        jpy: 80.92952472166,
        sgd: 0.7987256447,
        usd: 0.602261442083,
      },
      // No Subsidy
      winc: "85792228217",
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

    expect(data.winc).to.equal("85792228217");
    expect(data.fiat.usd).to.equal(0.752826802604);
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

    expect(data.fiat.usd).to.equal(0.432433150317);

    // 45% Subsidy Event applied
    expect(data.winc).to.equal("47185725519");
    expect(data.adjustments[0].adjustmentAmount).to.equal("-38606502698");
    clock.restore();
  });

  it("GET /rates/:currency returns 404 for non supported currency", async () => {
    const { status, statusText, data } = await axios.get(`/v1/rates/abc`);
    expect(status).to.equal(404);
    expect(statusText).to.equal("Not Found");
    expect(data).to.equal("Invalid currency.");
  });

  it("GET /rates/:currency returns 503 if unable to fetch prices", async () => {
    stub(pricingService, "getFiatPriceForOneAR").throws();
    const { status, statusText } = await axios.get(`/v1/rates/usd`);
    expect(status).to.equal(503);
    expect(statusText).to.equal("Service Unavailable");
  });

  it("GET /rates/:currency returns the correct response for supported currency", async () => {
    const { data, status, statusText } = await axios.get(`/v1/rates/usd`);

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    expect(data).to.deep.equal({
      currency: "usd",
      rate: expectedTokenPrices.arweave.usd,
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
        headers: await signedRequestHeadersFromJwk(testArweaveWallet, "123"),
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
          headers: await signedRequestHeadersFromJwk(testArweaveWallet, "123"),
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
        headers: await signedRequestHeadersFromJwk(testArweaveWallet, "123"),
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

  it("GET /price/:currency/:value returns 503 if fiat pricing oracle fails to get a price", async () => {
    stub(pricingService, "getWCForPayment").throws(Error("Really bad failure"));
    const { data, status, statusText } = await axios.get(`/v1/price/usd/5000`);

    expect(status).to.equal(503);
    expect(statusText).to.equal("Service Unavailable");
    expect(data).to.equal("Fiat Oracle Unavailable");
  });

  it("GET /balance returns 200 for correct signature", async () => {
    const { status, statusText, data } = await axios.get(`/v1/balance`, {
      headers: await signedRequestHeadersFromJwk(testArweaveWallet, "123"),
    });

    const balance = Number(data.winc);

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    expect(balance).to.equal(5000000);
  });

  it("GET /balance returns 200 and all approvals for a user with given and received delegated payment approvals", async () => {
    const userAddress =
      "Unique User -- Get Balance With Delegated Payment Approvals";

    await dbTestHelper.insertStubUser({
      user_address: userAddress,
      winston_credit_balance: "1000",
    });

    await dbTestHelper.db.createDelegatedPaymentApproval({
      payingAddress: userAddress,
      approvedAddress: randomCharString(),
      approvedWincAmount: W("500"), // Gives approval for 500 winston
      approvalDataItemId: randomCharString(),
    });
    const payingAddress = randomCharString();
    await dbTestHelper.insertStubUser({
      user_address: payingAddress,
      winston_credit_balance: "1000",
    });
    await dbTestHelper.db.createDelegatedPaymentApproval({
      payingAddress,
      approvedAddress: userAddress,
      approvedWincAmount: W("750"), // Receives approval for 750 winston
      approvalDataItemId: randomCharString(),
    });

    const { status, statusText, data } = await axios.get(
      `/v1/balance?address=${userAddress}`
    );

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    expect(data.controlledWinc).to.equal("1000");
    expect(data.winc).to.equal("500"); // 1000 - 500
    expect(data.effectiveBalance).to.equal("1250"); // 500 + 750

    expect(data.givenApprovals.length).to.equal(1);
    expect(data.receivedApprovals.length).to.equal(1);
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
        ...(await signedRequestHeadersFromJwk(testArweaveWallet, "123")),
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
      headers: await signedRequestHeadersFromJwk(testArweaveWallet),
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
    expect(payment_method_types).to.deep.equal(["card", "crypto"]);
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
    expect(payment_method_types).to.deep.equal(["card", "crypto"]);
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
          headers: await signedRequestHeadersFromJwk(testArweaveWallet, "123"),
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
          headers: await signedRequestHeadersFromJwk(testArweaveWallet, "123"),
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
      "Destination address is not a valid supported native wallet address!"
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

  it("GET /top-up returns 503 when fiat pricing oracle is unreachable", async () => {
    stub(pricingService, "getWCForPayment").throws(Error("Oh no!"));
    const { status, data, statusText } = await axios.get(
      `/v1/top-up/checkout-session/${testAddress}/usd/1337`
    );

    expect(data).to.equal("Fiat Oracle Unavailable");
    expect(status).to.equal(503);
    expect(statusText).to.equal("Service Unavailable");
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
        supportedFiatPaymentCurrencyTypes.map((currencyType) =>
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
        supportedFiatPaymentCurrencyTypes.map((currencyType) =>
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
      for (const currencyType of supportedFiatPaymentCurrencyTypes) {
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
      for (const currencyType of supportedFiatPaymentCurrencyTypes) {
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

  it("GET /top-up returns 503 when stripe fails to create payment session", async () => {
    const checkoutStub = stub(stripe.checkout.sessions, "create").throws(
      Error("Oh no!")
    );
    const { status, data, statusText } = await axios.get(
      `/v1/top-up/checkout-session/${testAddress}/usd/1337`
    );

    expect(data).to.equal("Error creating stripe payment session! Oh no!");
    expect(status).to.equal(503);
    expect(statusText).to.equal("Service Unavailable");
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

  const testAddresses = [
    // cspell:disable
    ["arweave", "ArweaveAddress43CharactersLong1234567890123"],
    ["solana", "AHpBdKdA9jjg2TkhXg3muAUJmAKgYnatvCoTRjxs1PT"], // cspell:enable
    ["ethereum", "0x1234567890123456789012345678901234567890"],
  ];

  for (const [token, address] of testAddresses) {
    before(async () => {
      await dbTestHelper.insertStubUser({
        user_address: address,
        winston_credit_balance: "1000",
      });
    });

    it(`GET /reserve-balance returns 200 for correct ${token} params`, async () => {
      const byteCount = 1;

      const adjustedWincTotal = new Winston("100");
      stub(pricingService, "getWCForBytes").resolves({
        finalPrice: new FinalPrice(adjustedWincTotal),
        networkPrice: new NetworkPrice(adjustedWincTotal),
        deprecatedChunkBasedNetworkPrice: new NetworkPrice(adjustedWincTotal),
        adjustments: [],
      });

      const { status, statusText, data } = await axios.get(
        `/v1/reserve-balance/${token}/${address}?byteCount=${byteCount}&dataItemId=${stubTxId2}`,
        authHeaders
      );
      expect(statusText).to.equal("Balance reserved");
      expect(status).to.equal(200);
      expect(data).to.equal("100");
    });

    it(`GET /top-up/checkout-session with a ${token} address in query params returns the correct response`, async () => {
      const amount = 1000;
      const checkoutStub = stub(stripe.checkout.sessions, "create").resolves(
        stripeResponseStub({
          ...checkoutSessionSuccessStub,
          amount_total: amount,
        })
      );

      const { status, statusText, data } = await axios.get(
        `/v1/top-up/checkout-session/${address}/usd/${amount}?token=${token}`
      );

      expect(data).to.have.property("topUpQuote");
      expect(data).to.have.property("paymentSession");
      expect(status).to.equal(200);
      expect(statusText).to.equal("OK");

      const { object, payment_method_types, amount_total, url } =
        data.paymentSession;

      expect(object).to.equal("checkout.session");
      expect(payment_method_types).to.deep.equal(["card", "crypto"]);
      expect(amount_total).to.equal(amount);
      expect(url).to.be.a.string;
      checkoutStub.restore();
    });

    it(`GET /redeem returns 200 for correct ${token} params`, async () => {
      const paymentReceiptId = "unique paymentReceiptI d" + Math.random();
      const emailAddress = "test@example.inc";
      const giftMessage = "hello the world!";

      const paymentReceiptDBInsert: PaymentReceiptDBInsert = {
        top_up_quote_id: "required top up id" + Math.random(),
        payment_receipt_id: paymentReceiptId,
        payment_amount: "100",
        quoted_payment_amount: "100",
        currency_type: "usd",
        destination_address: emailAddress,
        destination_address_type: "email",
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
        `/v1/redeem?destinationAddress=${address}&id=${paymentReceiptId}&email=${emailAddress}&token=${token}`
      );

      expect(status).to.equal(200);
      expect(statusText).to.equal("OK");

      const { message, userBalance, userAddress, userCreationDate } = data;
      expect(message).to.equal("Payment receipt redeemed for 100 winc!");
      expect(userBalance).to.equal("1000");
      expect(userAddress).to.equal(address);
      expect(userCreationDate).to.exist;

      const userDbResult = await paymentDatabase["reader"]<UserDBResult>(
        tableNames.user
      ).where({
        user_address: address,
      });
      expect(userDbResult.length).to.equal(1);
      expect(userDbResult[0].winston_credit_balance).to.equal("1000");

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
      expect(destination_address).to.equal(address);
      expect(expiration_date).to.exist;
      expect(gifted_winc_amount).to.equal("100");
      expect(redemption_date).to.exist;
    });
  }

  it("GET /reserve-balance legacy route returns 200 for correct params", async () => {
    const testAddress = "TotallyUniqueUserForThisReserveBalanceTest1";
    await dbTestHelper.insertStubUser({
      user_address: testAddress,
      winston_credit_balance: "1000000000",
    });

    const byteCount = 1;

    const adjustedWincTotal = new Winston("100");
    stub(pricingService, "getWCForBytes").resolves({
      finalPrice: new FinalPrice(adjustedWincTotal),
      networkPrice: new NetworkPrice(adjustedWincTotal),
      deprecatedChunkBasedNetworkPrice: new NetworkPrice(adjustedWincTotal),
      adjustments: [],
    });

    const { status, statusText, data } = await axios.get(
      `/v1/reserve-balance/arweave/${testAddress}?byteCount=${byteCount}&dataItemId=${stubTxId2}`,
      authHeaders
    );
    expect(statusText).to.equal("Balance reserved");
    expect(status).to.equal(200);
    expect(data).to.equal("100");
  });

  it("GET /reserve-balance returns 401 for missing authorization", async () => {
    const byteCount = 1000;

    const { status, statusText } = await axios.get(
      `/v1/reserve-balance/arweave/${testAddress}?byteCount=${byteCount}&dataItemId=${stubTxId1}`
    );
    expect(statusText).to.equal(
      "No authorization or user provided for authorized route!"
    );
    expect(status).to.equal(401);
  });

  it("GET /reserve-balance returns 200 when within the PDS Free subsidy event threshold and limitation", async () => {
    const byteCount = 100000;

    const adjustedWincTotal = new Winston("100");
    stub(pricingService, "getWCForBytes").resolves({
      finalPrice: new FinalPrice(adjustedWincTotal),
      networkPrice: new NetworkPrice(adjustedWincTotal),
      deprecatedChunkBasedNetworkPrice: new NetworkPrice(adjustedWincTotal),
      adjustments: [],
    });

    const { status, statusText, data } = await axios.get(
      `/v1/reserve-balance/arweave/${testAddress}?byteCount=${byteCount}&dataItemId=${stubTxId1}`,
      authHeaders
    );
    expect(statusText).to.equal("Balance reserved");
    expect(status).to.equal(200);
    expect(data).to.equal("100");
  });

  it("GET /reserve-balance returns 402 for insufficient balance when calculated winc amount for upload would exceed the PDS Free Subsidy Event limitation", async () => {
    const stubUploadAdjustment: UploadAdjustmentDBInsert = {
      adjusted_winc_amount: "-1000000000000",
      catalog_id: await paymentDatabase[
        "reader"
      ]<UploadAdjustmentCatalogDBResult>(tableNames.uploadAdjustmentCatalog)
        .where({ adjustment_name: "PDS Limited Subsidy Event" })
        .first()
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        .then((r) => r!.catalog_id),
      user_address: testAddress,
      adjustment_index: 0,
      reservation_id: "a unique ID",
    };
    await paymentDatabase["writer"](tableNames.uploadAdjustment).insert(
      stubUploadAdjustment
    );

    const byteCount = 100000000;

    const { status, statusText } = await axios.get(
      `/v1/reserve-balance/arweave/${testAddress}?byteCount=${byteCount}&dataItemId=${stubTxId1}`,
      authHeaders
    );
    expect(statusText).to.equal("Insufficient balance");
    expect(status).to.equal(402);
  });

  it("GET /reserve-balance returns 402 for insufficient balance when byte count is above PDS Free Subsidy Event threshold", async () => {
    const byteCount = 600000;

    const { status, statusText } = await axios.get(
      `/v1/reserve-balance/arweave/${testAddress}?byteCount=${byteCount}&dataItemId=${stubTxId1}`,
      authHeaders
    );
    expect(statusText).to.equal("Insufficient balance");
    expect(status).to.equal(402);
  });

  it("GET /reserve-balance returns 402 if user not found", async () => {
    const testAddress = "TotallyUniqueUserForThisReserveBalanceTest2";
    const byteCount = 10000000;

    const { status, statusText } = await axios.get(
      `/v1/reserve-balance/arweave/${testAddress}?byteCount=${byteCount}&dataItemId=${stubTxId1}`,
      authHeaders
    );
    expect(statusText).to.equal("Insufficient balance");
    expect(status).to.equal(402);
  });

  it("GET /check-balance returns 200 for correct params", async () => {
    const testAddress = randomCharString();
    await dbTestHelper.insertStubUser({
      user_address: testAddress,
      winston_credit_balance: "1000000000",
    });

    const byteCount = 1024 * 1024; // 1 MiB

    const adjustedWincTotal = new Winston("100");
    stub(pricingService, "getWCForBytes").resolves({
      finalPrice: new FinalPrice(adjustedWincTotal),
      networkPrice: new NetworkPrice(adjustedWincTotal),
      deprecatedChunkBasedNetworkPrice: new NetworkPrice(adjustedWincTotal),
      adjustments: [],
    });

    const { status, statusText, data } = await axios.get(
      `/v1/check-balance/arweave/${testAddress}?byteCount=${byteCount}`,
      authHeaders
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
      `/v1/check-balance/arweave/${testAddress}?byteCount=${byteCount}`
    );
    expect(statusText).to.equal("Unauthorized");
    expect(status).to.equal(401);
  });

  it("GET /check-balance returns 402 for insufficient balance", async () => {
    const byteCount = 10000000;

    const { status, statusText } = await axios.get(
      `/v1/check-balance/arweave/${testAddress}?byteCount=${byteCount}`,
      authHeaders
    );
    expect(statusText).to.equal("Insufficient balance");
    expect(status).to.equal(402);
  });

  it("GET /check-balance returns 404 if user not found and above PDS Subsidy event threshold", async () => {
    const byteCount = 1024 * 1024 * 100;

    const { status, statusText } = await axios.get(
      `/v1/check-balance/arweave/${randomCharString()}?byteCount=${byteCount}`,
      authHeaders
    );
    expect(statusText).to.equal("User not found");
    expect(status).to.equal(404);
  });

  it("GET /check-balance returns 200 if user not found and below PDS Subsidy event threshold", async () => {
    const byteCount = 1024 * 4; // 4 KiB

    const { status, statusText } = await axios.get(
      `/v1/check-balance/arweave/${testAddress}?byteCount=${byteCount}`,
      authHeaders
    );
    expect(status).to.equal(200);
    expect(statusText).to.equal("User has sufficient balance");
  });

  describe("GET /check-balance with multiple payers in paidBy query params", () => {
    const signerAddress = randomCharString();
    const payer1Address = randomCharString();
    const payer2Address = randomCharString();

    before(async () => {
      await dbTestHelper.insertStubUser({
        user_address: signerAddress,
        winston_credit_balance: "100",
      });
      await dbTestHelper.createStubDelegatedPaymentApproval({
        approved_address: signerAddress,
        paying_address: payer1Address,
        approved_winc_amount: "25",
      });
      await dbTestHelper.createStubDelegatedPaymentApproval({
        approved_address: signerAddress,
        paying_address: payer2Address,
        approved_winc_amount: "25",
      });
    });

    it("returns 200 for an affordable winc amounts", async () => {
      const adjustedWincTotal = new Winston("100");
      stub(pricingService, "getWCForBytes").resolves({
        finalPrice: new FinalPrice(adjustedWincTotal),
        networkPrice: new NetworkPrice(adjustedWincTotal),
        deprecatedChunkBasedNetworkPrice: new NetworkPrice(adjustedWincTotal),
        adjustments: [],
      });

      const { data, status, statusText } = await axios.get(
        `/v1/check-balance/arweave/${signerAddress}?byteCount=1000&paidBy=${payer1Address},${payer2Address}`,
        authHeaders
      );

      expect(statusText).to.equal("User has sufficient balance");
      expect(status).to.equal(200);
      expect(data).to.deep.equal({
        userHasSufficientBalance: true,
        bytesCostInWinc: "100",
        userBalanceInWinc: "150",
        adjustments: [],
      });
    });

    it("returns 402 when neither the provided payers nor the signer can satisfy the entire winc amount", async () => {
      const adjustedWincTotal = new Winston("1000");
      stub(pricingService, "getWCForBytes").resolves({
        finalPrice: new FinalPrice(adjustedWincTotal),
        networkPrice: new NetworkPrice(adjustedWincTotal),
        deprecatedChunkBasedNetworkPrice: new NetworkPrice(adjustedWincTotal),
        adjustments: [],
      });

      const { data, status, statusText } = await axios.get(
        `/v1/check-balance/arweave/${signerAddress}?byteCount=1000&paidBy=${payer1Address},${payer2Address}`,
        authHeaders
      );

      expect(statusText).to.equal("Insufficient balance");
      expect(status).to.equal(402);
      expect(data).to.deep.equal({
        userHasSufficientBalance: false,
        bytesCostInWinc: adjustedWincTotal.toString(),
        userBalanceInWinc: "150",
      });
    });
  });

  it("GET /refund-balance returns 200 for correct params", async () => {
    const winstonCredits = 1000;

    const { status, statusText } = await axios.get(
      `/v1/refund-balance/arweave/${testAddress}?winstonCredits=${winstonCredits}&dataItemId=${randomCharString()}`,
      authHeaders
    );
    expect(statusText).to.equal("Balance refunded");
    expect(status).to.equal(200);
  });

  it("GET /refund-balance returns 401 for missing authorization", async () => {
    const winstonCredits = 1000;

    const { status, statusText } = await axios.get(
      `/v1/refund-balance/arweave/${testAddress}?winstonCredits=${winstonCredits}&dataItemId=${stubTxId1}`
    );
    expect(statusText).to.equal("Unauthorized");
    expect(status).to.equal(401);
  });

  it("GET /refund-balance returns 404 if user not found", async () => {
    const testAddress = randomCharString();
    const dataItemId = randomCharString();
    const winstonCredits = 100000;

    const { status, statusText } = await axios.get(
      `/v1/refund-balance/arweave/${testAddress}?winstonCredits=${winstonCredits}&dataItemId=${dataItemId}`,
      authHeaders
    );

    expect(statusText).to.equal("User not found");
    expect(status).to.equal(404);
  });

  it("GET /currencies returns status 200 and the expected list of currencies and limits", async () => {
    const { status, statusText, data } = await axios.get(`/v1/currencies`);

    expect(data.supportedCurrencies).to.deep.equal(
      supportedFiatPaymentCurrencyTypes
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
        winstonCreditAmount: "500",
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
        winstonCreditAmount: "500",
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

  it("POST /stripe-webhook returns 200 for a valid stripe payment event from an ArNS Purchase Quote", async () => {
    const paymentReceivedEventId = "A Payment Receipt Id";
    const paymentReceivedUserAddress = "User Address Stubbed";
    const paymentStubNonce = "0x0987654321";
    const testName = "testName90000";

    await dbTestHelper.insertStubUser({
      user_address: paymentReceivedUserAddress,
      winston_credit_balance: "0",
    });

    await dbTestHelper.insertStubArNSQuote({
      nonce: paymentStubNonce,
      name: testName,
      intent: "Buy-Name",
      type: "permabuy",
      payment_amount: "100",
      quoted_payment_amount: "100",
      owner: paymentReceivedUserAddress,
    });

    const successStub = paymentIntentStub({
      id: paymentReceivedEventId,
      metadata: {
        nonce: paymentStubNonce,
      },
      amount: 100,
      currency: "usd",
    });

    stub(gatewayMap.ario, "initiateArNSPurchase").resolves({ id: "0" });
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

    expect(webhookStub.calledOnce).to.equal(true);

    const arnsReceipt = await paymentDatabase["reader"]<ArNSPurchaseDBResult>(
      tableNames.arNSPurchaseReceipt
    ).where({
      nonce: paymentStubNonce,
    });

    expect(arnsReceipt.length).to.equal(1);
    const {
      payment_amount,
      quoted_payment_amount,
      created_date,
      intent,
      mario_qty,
      name,
      nonce,
      owner,
      usd_ar_rate,
      usd_ario_rate,
      winc_qty,
      currency_type,
      increase_qty,
      payment_provider,
      process_id,
      quote_creation_date,
      quote_expiration_date,
      type,
      years,
    } = arnsReceipt[0];

    expect(payment_amount).to.equal(100);
    expect(quoted_payment_amount).to.equal(100);
    expect(currency_type).to.equal("usd");
    expect(payment_provider).to.equal("stripe");
    expect(name).to.equal(testName);
    expect(owner).to.equal(paymentReceivedUserAddress);
    expect(nonce).to.equal(paymentStubNonce);
    expect(intent).to.equal("Buy-Name");
    expect(type).to.equal("permabuy");
    expect(usd_ar_rate).to.equal("1.00");
    expect(usd_ario_rate).to.equal("1.00");
    expect(winc_qty).to.equal("1337");
    expect(mario_qty).to.equal("1337");
    expect(years).to.equal(null);
    expect(increase_qty).to.equal(null);
    expect(process_id).to.equal(stubTxId1);
    expect(quote_creation_date).to.exist;
    expect(quote_expiration_date).to.exist;
    expect(created_date).to.exist;
  });

  it("GET /rates returns 503 if unable to fetch prices", async () => {
    stub(pricingService, "getWCForBytes").throws(Error("Serious failure"));

    const { status, statusText } = await axios.get(`/v1/rates`);

    expect(status).to.equal(503);
    expect(statusText).to.equal("Service Unavailable");
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
      "Provided destination address is not a valid native address!"
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

  it("GET /account/balance returns 200 for valid params", async () => {
    const testAddress = "a stub address unique to this test 200";
    await dbTestHelper.insertStubUser({
      user_address: testAddress,
      winston_credit_balance: "1000000000",
    });

    const { status, statusText, data } = await axios.get(
      `/v1/account/balance?address=${testAddress}`
    );

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");
    expect(data).to.deep.equal({
      winc: "1000000000",
      balance: "1000000000",
      effectiveBalance: "1000000000",
      controlledWinc: "1000000000",
      givenApprovals: [],
      receivedApprovals: [],
    });
  });

  for (const token of userAddressTypes) {
    it(`GET /account/balance/${token} returns 200 for valid params`, async () => {
      const testAddress = "a stub address for token test" + token;
      await dbTestHelper.insertStubUser({
        user_address: testAddress,
        winston_credit_balance: "1337",
        user_address_type: token,
      });

      const { status, statusText, data } = await axios.get(
        `/v1/account/balance/${token}?address=${testAddress}`
      );

      expect(status).to.equal(200);
      expect(statusText).to.equal("OK");
      expect(data).to.deep.equal({
        winc: "1337",
        balance: "1337",
        effectiveBalance: "1337",
        controlledWinc: "1337",
        givenApprovals: [],
        receivedApprovals: [],
      });
    });

    it(`GET /account/balance/${token} returns 400 for missing address`, async () => {
      const { status, statusText, data } = await axios.get(
        `/v1/account/balance/${token}`
      );

      expect(status).to.equal(400);
      expect(statusText).to.equal("Bad Request");
      expect(data).to.equal("Missing address in query parameters");
    });

    it(`GET /account/balance/${token} returns 404 if user not found`, async () => {
      const testAddress = "someRandomAddress";

      const { status, statusText, data } = await axios.get(
        `/v1/account/balance/${token}?address=${testAddress}`
      );

      expect(status).to.equal(404);
      expect(statusText).to.equal("Not Found");
      expect(data).to.equal("User Not Found");
    });

    it(`GET /account/balance/${token} returns 503 if database is unreachable`, async () => {
      const testAddress = "a stub address";
      stub(paymentDatabase, "getBalance").throws(Error("Bad news"));

      const { status, statusText, data } = await axios.get(
        `/v1/account/balance/${token}?address=${testAddress}`
      );

      expect(status).to.equal(503);
      expect(statusText).to.equal("Service Unavailable");
      expect(data).to.equal("Cloud Database Unavailable");
    });

    it(`POST /account/balance/${token} returns 200 for valid transaction that has confirmed status`, async () => {
      const testTxId = `a stub tx id unique to this ${token} post balance test`;
      const transactionSenderAddress =
        "TotallyUniqueUserForThisPostBalTest1" + token;

      const tokenAmount = "100000000";

      stub(gatewayMap[token], "getTransaction").resolves({
        transactionQuantity: BigNumber(tokenAmount),
        transactionSenderAddress: transactionSenderAddress,
        transactionRecipientAddress: walletAddresses[token],
      });
      stub(gatewayMap[token], "getTransactionStatus").resolves({
        blockHeight: 1,
        status: "confirmed",
      });

      const { status, statusText, data } = await axios.post(
        `/v1/account/balance/${token}`,
        {
          tx_id: testTxId,
        }
      );

      const turboInfraFeeMagnitude =
        token === "ario" ? 1 : token === "kyve" ? 0.5 : 0.766;
      const ratio =
        expectedTokenPrices[tokenNameToCoinGeckoTokenName[token]].usd /
        expectedTokenPrices.arweave.usd;
      const wc = W(
        baseAmountToTokenAmount(tokenAmount, token)
          .times(ratio)
          .shiftedBy(12)
          .toFixed(0, BigNumber.ROUND_DOWN)
      );
      const finalWc = wc.times(turboInfraFeeMagnitude);
      const infraFeeReducedWc = finalWc.minus(wc);

      expect(status).to.equal(200);
      expect(statusText).to.equal("OK");
      expect(data).to.deep.equal({
        creditedTransaction: {
          adjustments:
            token === "ario"
              ? []
              : [
                  {
                    adjustmentAmount: infraFeeReducedWc.valueOf(),
                    currencyType: token,
                    description:
                      "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
                    name:
                      (token === "kyve" ? "Kyve " : "") +
                      "Turbo Infrastructure Fee",
                    operator: "multiply",
                    operatorMagnitude: turboInfraFeeMagnitude,
                  },
                ],
          blockHeight: 1,
          destinationAddress: transactionSenderAddress,
          destinationAddressType: token,
          transactionId: testTxId,
          transactionQuantity: tokenAmount,
          tokenType: token,
          winstonCreditAmount: finalWc.valueOf(),
        },
        message: "Transaction credited",
      });
    });

    it(`POST /account/balance/${token} returns 202 for valid transaction that has pending status`, async () => {
      const testTxId = `a stub tx id unique to this ${token} pending payment balance test`;
      const transactionSenderAddress =
        "TotallyUniqueUserForThisPostBalTest2" + token;

      const tokenAmount = "100000000";

      stub(gatewayMap[token], "getTransaction").resolves({
        transactionSenderAddress,
        transactionQuantity: BigNumber(tokenAmount),
        transactionRecipientAddress: walletAddresses[token],
      });
      stub(gatewayMap[token], "getTransactionStatus").resolves({
        status: "pending",
      });

      const { status, statusText, data } = await axios.post(
        `/v1/account/balance/${token}`,
        {
          tx_id: testTxId,
        }
      );

      const turboInfraFeeMagnitude =
        token === "ario" ? 1 : token === "kyve" ? 0.5 : 0.766;
      const ratio =
        expectedTokenPrices[tokenNameToCoinGeckoTokenName[token]].usd /
        expectedTokenPrices.arweave.usd;
      const wc = W(
        baseAmountToTokenAmount(tokenAmount, token)
          .times(ratio)
          .shiftedBy(12)
          .toFixed(0, BigNumber.ROUND_DOWN)
      );
      const finalWc = wc.times(turboInfraFeeMagnitude);
      const infraFeeReducedWc = finalWc.minus(wc);

      expect(status).to.equal(202);
      expect(statusText).to.equal("Accepted");
      expect(data).to.deep.equal({
        pendingTransaction: {
          adjustments:
            token === "ario"
              ? []
              : [
                  {
                    adjustmentAmount: infraFeeReducedWc.valueOf(),
                    currencyType: token,
                    description:
                      "Inclusive usage fee on all payments to cover infrastructure costs and payment provider fees.",
                    name:
                      (token === "kyve" ? "Kyve " : "") +
                      "Turbo Infrastructure Fee",
                    operator: "multiply",
                    operatorMagnitude: turboInfraFeeMagnitude,
                  },
                ],
          transactionId: testTxId,
          transactionQuantity: tokenAmount,
          tokenType: token,
          destinationAddress: transactionSenderAddress,
          destinationAddressType: token,
          winstonCreditAmount: finalWc.valueOf(),
        },
        message: "Transaction pending",
      });
    });

    it(`POST /account/balance/${token} returns 404 for a transaction that does not exist`, async () => {
      const testTxId = `a stub tx id unique to this ${token} not found post balance test`;

      stub(gatewayMap[token], "getTransaction").throws(
        new PaymentTransactionNotFound(testTxId)
      );

      const { status, statusText, data } = await axios.post(
        `/v1/account/balance/${token}`,
        {
          tx_id: testTxId,
        }
      );

      expect(status).to.equal(404);
      expect(statusText).to.equal("Not Found");
      expect(data).to.equal("Transaction not found");
    });
  }

  it("POST /account/balance/ethereum returns 400 when a payment tx contains a wei amount that is converted to less than one winc", async () => {
    const testTxId =
      "a stub tx id unique to this ethereum wei not enough post balance test";
    const transactionSenderAddress =
      "TotallyUniqueUserForThisPostBalTest1ethereum";

    const tokenAmount = "1";

    stub(gatewayMap.ethereum, "getTransaction").resolves({
      transactionQuantity: BigNumber(tokenAmount),
      transactionSenderAddress: transactionSenderAddress,
      transactionRecipientAddress: walletAddresses.ethereum,
    });
    stub(gatewayMap.ethereum, "getTransactionStatus").resolves({
      blockHeight: 1,
      status: "confirmed",
    });

    const { status, statusText, data } = await axios.post(
      `/v1/account/balance/ethereum`,
      {
        tx_id: testTxId,
      }
    );
    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
    expect(data).to.equal(
      "Crypto payment amount is too small! Token value must convert to at least one winc"
    );
  });

  it("POST /account/balance/arweave returns 200 for valid transaction that has already been confirmed from the database", async () => {
    const txId = "unique 200 confirmed test id";
    const destination_address = "TotallyUniqueUserForThisArweavePostBalTest3";

    await dbTestHelper.db["writer"](
      tableNames.creditedPaymentTransaction
    ).insert({
      transaction_id: txId,
      destination_address,
      destination_address_type: "arweave",
      token_type: "arweave",
      transaction_quantity: "1",
      winston_credit_amount: "0",
      block_height: 1,
    });

    const { status, statusText, data } = await axios.post(
      `/v1/account/balance/arweave`,
      {
        tx_id: txId,
      }
    );

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");
    expect(data.message).to.equal("Transaction already credited");

    expect(
      filterKeysFromObject(data.creditedTransaction, ["createdDate"])
    ).deep.equal({
      blockHeight: "1",
      destinationAddress: destination_address,
      destinationAddressType: "arweave",
      transactionId: txId,
      transactionQuantity: "1",
      tokenType: "arweave",
      winstonCreditAmount: "0",
    });
  });

  it("POST /account/balance/arweave returns 202 for valid transaction that has already pending from the database", async () => {
    const txId = "unique 202 pending test id";
    const destination_address = "TotallyUniqueUserForThisArweavePostBalTest4";

    await dbTestHelper.db["writer"](
      tableNames.pendingPaymentTransaction
    ).insert({
      transaction_id: txId,
      destination_address,
      destination_address_type: "arweave",
      token_type: "arweave",
      transaction_quantity: "1",
      winston_credit_amount: "0",
    });

    const { status, statusText, data } = await axios.post(
      `/v1/account/balance/arweave`,
      {
        tx_id: txId,
      }
    );

    expect(status).to.equal(202);
    expect(statusText).to.equal("Accepted");

    expect(data.message).to.equal("Transaction already pending");
    expect(
      filterKeysFromObject(data.pendingTransaction, ["createdDate"])
    ).deep.equal({
      destinationAddress: destination_address,
      destinationAddressType: "arweave",
      transactionId: txId,
      transactionQuantity: "1",
      tokenType: "arweave",
      winstonCreditAmount: "0",
    });
  });

  it("POST /account/balance/arweave returns 403 for tx that has a sender on the excluded address list", async () => {
    stub(gatewayMap.arweave, "getTransaction").resolves({
      transactionSenderAddress: "testExcludedAddress",
      transactionQuantity: BigNumber("500"),
      transactionRecipientAddress: walletAddresses.arweave,
    });

    const { status, statusText, data } = await axios.post(
      `/v1/account/balance/arweave`,
      {
        tx_id: "testTxId",
      }
    );

    expect(status).to.equal(403);
    expect(statusText).to.equal("Forbidden");
    expect(data).to.equal(
      "Payment transaction 'testTxId' has sender that is on the excluded address list: 'testExcludedAddress'"
    );
  });

  it("POST /account/balance/arweave returns 400 for tx that is less than one winston in quantity", async () => {
    const transactionSenderAddress =
      "TotallyUniqueUserForThisArweavePostBalTest5";

    stub(gatewayMap.arweave, "getTransaction").resolves({
      transactionSenderAddress,
      transactionQuantity: BigNumber("0"),
      transactionRecipientAddress: walletAddresses.arweave,
    });

    const { status, statusText, data } = await axios.post(
      `/v1/account/balance/arweave`,
      {
        tx_id: "testTxId",
      }
    );

    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
    expect(data).to.equal("Transaction quantity must be greater than 0");
  });

  it("POST /account/balance/arweave returns 400 for missing JSON", async () => {
    const { status, statusText, data } = await axios.post(
      `/v1/account/balance/arweave`
    );

    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
    expect(data).to.equal("Invalid JSON in request body");
  });

  it("POST /account/balance/arweave returns 400 for missing tx_id", async () => {
    const { status, statusText, data } = await axios.post(
      `/v1/account/balance/arweave`,
      { pants: "none" }
    );

    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
    expect(data).to.equal("Missing tx_id in request body");
  });

  it("POST /account/balance/arweave returns 400 for invalid currency", async () => {
    const { status, statusText, data } = await axios.post(
      `/v1/account/balance/invalidCurrency`,
      {
        tx_id: "TotallyUniqueUserForThisArweavePostBalTest8",
      }
    );

    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
    expect(data).to.equal("Token not supported");
  });

  it("POST /account/balance/arweave returns 500 for gateway not found", async () => {
    stub(gatewayMap, "arweave").value(undefined);
    const { status, statusText, data } = await axios.post(
      `/v1/account/balance/arweave`,
      {
        tx_id: "TotallyUniqueUserForThisArweavePostBalTest7",
      }
    );

    expect(status).to.equal(503);
    expect(statusText).to.equal("Service Unavailable");
    expect(data).to.equal("Gateway not found for currency!");
  });

  describe("GET /accounts/approvals/create", () => {
    it("returns 200 for valid params", async () => {
      const payingAddress = "43CharacterStubApprovalCreateAddress1234567";
      const approvalDataItemId = "43CharacterStubApprovalCreateId123456789012";
      const approvedAddress = "43CharacterStubApprovalCreateApprovedAdd123";
      const approvedWincAmount = "100";

      await dbTestHelper.insertStubUser({
        user_address: payingAddress,
        winston_credit_balance: "1000",
      });

      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/create?payingAddress=${payingAddress}&approvedAddress=${approvedAddress}&dataItemId=${approvalDataItemId}&winc=${approvedWincAmount}&expiresInSeconds=3600`,
        authHeaders
      );

      expect(status).to.equal(200);
      expect(statusText).to.equal("Approval created");

      expect(data.creationDate).to.exist;
      expect(data.expirationDate).to.exist;
      expect(
        filterKeysFromObject(data, ["creationDate", "expirationDate"])
      ).to.deep.equal({
        approvalDataItemId,
        approvedAddress,
        approvedWincAmount,
        payingAddress: payingAddress,
        usedWincAmount: "0",
      });
    });

    it("returns 400 for missing params", async () => {
      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/create`,
        authHeaders
      );

      expect(status).to.equal(400);
      expect(statusText).to.equal("Bad Request");
      expect(data).to.equal(
        "Malformed or missing required query parameters: payingAddress, approvedAddress"
      );
    });

    it("returns 400 for invalid paying address", async () => {
      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/create?payingAddress=invalid&approvedAddress=${stubArweaveUserAddress}&dataItemId=${stubTxId1}&winc=100`,
        authHeaders
      );

      expect(status).to.equal(400);
      expect(statusText).to.equal("Bad Request");
      expect(data).to.equal("Invalid paying address");
    });

    it("returns 400 for invalid approved address", async () => {
      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/create?payingAddress=${stubArweaveUserAddress}&approvedAddress=invalid&dataItemId=${stubTxId1}&winc=100`,
        authHeaders
      );

      expect(status).to.equal(400);
      expect(statusText).to.equal("Bad Request");
      expect(data).to.equal("Invalid approved address");
    });

    it("returns 400 for invalid data item id", async () => {
      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/create?payingAddress=${stubArweaveUserAddress}&approvedAddress=${stubArweaveUserAddress}&dataItemId=invalid&winc=100`,
        authHeaders
      );

      expect(status).to.equal(400);
      expect(statusText).to.equal("Bad Request");
      expect(data).to.equal("Invalid dataItemId provided!");
    });

    it("returns 400 for invalid winc amount", async () => {
      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/create?payingAddress=${stubArweaveUserAddress}&approvedAddress=${stubArweaveUserAddress}&dataItemId=${stubTxId1}&winc=0.4300`,
        authHeaders
      );

      expect(status).to.equal(400);
      expect(statusText).to.equal("Bad Request");
      expect(data).to.equal(
        "Invalid value provided for wincAmount: 0.4300\nWinston value should be an integer!"
      );
    });

    it("returns 401 for unauthorized access", async () => {
      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/create?payingAddress=${stubArweaveUserAddress}&approvedAddress=${stubArweaveUserAddress}&dataItemId=${stubTxId1}&winc=100`
      );

      expect(status).to.equal(401);
      expect(statusText).to.equal("Unauthorized");
      expect(data).to.equal(
        "No authorization or user provided for authorized route!"
      );
    });

    it("returns 402 for user not found for payment approval", async () => {
      const unknownAddress = "43CharacterAddressWithNoBalance123456789012";
      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/create?payingAddress=${unknownAddress}&approvedAddress=${stubArweaveUserAddress}&dataItemId=${stubTxId1}&winc=100`,
        authHeaders
      );

      expect(status).to.equal(402);
      expect(statusText).to.equal("Payment Required");
      expect(data).to.equal(
        "No user found in database with address '" + unknownAddress + "'"
      );
    });

    it("returns 402 for insufficient balance for payment approval", async () => {
      const payingAddress = "43CharacterAddressWithLowBalance12345678901";
      await dbTestHelper.insertStubUser({
        user_address: payingAddress,
        winston_credit_balance: "100",
      });

      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/create?payingAddress=${payingAddress}&approvedAddress=${stubArweaveUserAddress}&dataItemId=${stubTxId1}&winc=1000`,
        authHeaders
      );

      expect(status).to.equal(402);
      expect(statusText).to.equal("Payment Required");
      expect(data).to.equal("Insufficient balance for '" + payingAddress + "'");
    });

    it("returns 503 for unexpected database errors", async () => {
      stub(paymentDatabase, "createDelegatedPaymentApproval").throws(
        Error("Database error")
      );

      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/create?payingAddress=${stubArweaveUserAddress}&approvedAddress=${stubArweaveUserAddress}&dataItemId=${stubTxId1}&winc=100`,
        authHeaders
      );

      expect(status).to.equal(503);
      expect(statusText).to.equal("Service Unavailable");
      expect(data).to.equal("Database error");
    });
  });
  describe("GET /accounts/approvals/revoke", () => {
    it("returns 200 for valid params", async () => {
      const approvedAddress = "43CharacterStubApprovalRevokeApprovedAdd123";
      const payingAddress = "43CharacterStubApprovalRevokeAddress1234567";
      const revokeDataItemId = "43CharacterStubApprovalRevokeId123456789012";
      const approvalDataItemId = "unique gibberish";

      await dbTestHelper.insertStubUser({
        user_address: payingAddress,
        winston_credit_balance: "1000",
      });

      await dbTestHelper.db.createDelegatedPaymentApproval({
        approvalDataItemId,
        payingAddress: payingAddress,
        approvedAddress: approvedAddress,
        approvedWincAmount: W(100),
      });

      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/revoke?payingAddress=${payingAddress}&approvedAddress=${approvedAddress}&dataItemId=${revokeDataItemId}`,
        authHeaders
      );

      expect(status).to.equal(200);
      expect(statusText).to.equal("Approvals revoked");

      expect(data[0].creationDate).to.exist;
      expect(data[0].inactiveDate).to.exist;
      expect(
        filterKeysFromObject(data[0], ["creationDate", "inactiveDate"])
      ).to.deep.equal({
        approvedAddress,
        payingAddress,
        approvedWincAmount: "100",
        usedWincAmount: "0",
        inactiveReason: "revoked",
        revokeDataItemId,
        approvalDataItemId,
      });
    });

    it("returns 400 for missing params", async () => {
      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/revoke`,
        authHeaders
      );

      expect(status).to.equal(400);
      expect(statusText).to.equal("Bad Request");
      expect(data).to.equal(
        "Malformed or missing required query parameters: payingAddress, approvedAddress"
      );
    });

    it("returns 401 for unauthorized access", async () => {
      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/revoke?payingAddress=${stubArweaveUserAddress}&approvedAddress=${stubArweaveUserAddress}&dataItemId=${stubTxId1}`
      );

      expect(status).to.equal(401);
      expect(statusText).to.equal("Unauthorized");
      expect(data).to.equal(
        "No authorization or user provided for authorized route!"
      );
    });

    it("returns 400 for no approvals found to revoke", async () => {
      const unknownUserAddress = "43CharacterAddressWithNoApprovals1234567890";
      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/revoke?payingAddress=${unknownUserAddress}&approvedAddress=${stubArweaveUserAddress}&dataItemId=${stubTxId1}`,
        authHeaders
      );

      expect(status).to.equal(400);
      expect(statusText).to.equal("Bad Request");
      expect(data).to.equal(
        `No valid approvals found for approved address '${stubArweaveUserAddress}' and paying address '${unknownUserAddress}'`
      );
    });

    it("returns 503 for unexpected database errors", async () => {
      stub(paymentDatabase, "revokeDelegatedPaymentApprovals").throws(
        Error("Database error")
      );

      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/revoke?payingAddress=${stubArweaveUserAddress}&approvedAddress=${stubArweaveUserAddress}&dataItemId=${stubTxId1}`,
        authHeaders
      );

      expect(status).to.equal(503);
      expect(statusText).to.equal("Service Unavailable");
      expect(data).to.equal("Database error");
    });
  });

  describe("GET approvals /accounts/approvals", () => {
    it("returns 200 for valid params", async () => {
      const payingAddress = "43CharacterStubApprovalGetAddress1234567890";
      const approvalDataItemId = "43CharacterStubApprovalGetId123456789012345";
      await dbTestHelper.insertStubUser({
        user_address: payingAddress,
        winston_credit_balance: "1000",
      });

      const approvedAddress = "43CharacterStubApprovalGetApprovedAddress12";

      await dbTestHelper.db.createDelegatedPaymentApproval({
        approvalDataItemId,
        payingAddress,
        approvedAddress,
        approvedWincAmount: W(100),
      });

      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals?payingAddress=${payingAddress}&approvedAddress=${approvedAddress}`
      );

      expect(status).to.equal(200);
      expect(statusText).to.equal("Approvals retrieved");

      const approvals = data.approvals;
      expect(approvals.length).to.equal(1);
      expect(approvals[0].creationDate).to.exist;
      expect(approvals[0].expirationDate).to.be.undefined;

      expect(data.amount).to.equal("100");
      expect(data.expiresBy).to.be.undefined;

      expect(
        filterKeysFromObject(approvals[0], ["creationDate"])
      ).to.deep.equal({
        approvalDataItemId,
        payingAddress,
        approvedAddress,
        approvedWincAmount: "100",
        usedWincAmount: "0",
      });
    });

    it("returns 400 for missing params", async () => {
      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals`
      );

      expect(status).to.equal(400);
      expect(statusText).to.equal("Bad Request");
      expect(data).to.equal(
        "Malformed or missing required query parameters: payingAddress, approvedAddress"
      );
    });

    it("returns 400 if no approvals found", async () => {
      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals?payingAddress=${stubArweaveUserAddress}&approvedAddress=${stubArweaveUserAddress}`
      );

      expect(status).to.equal(400);
      expect(statusText).to.equal("Bad Request");
      expect(data).to.equal(
        `No valid approvals found for approved address '${stubArweaveUserAddress}' and paying address '${stubArweaveUserAddress}'`
      );
    });

    it("returns 503 for unexpected database errors", async () => {
      stub(paymentDatabase, "getApprovalsFromPayerForAddress").throws(
        Error("Database error")
      );

      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals?payingAddress=${stubArweaveUserAddress}&approvedAddress=${stubArweaveUserAddress}`
      );

      expect(status).to.equal(503);
      expect(statusText).to.equal("Service Unavailable");
      expect(data).to.equal("Database error");
    });
  });

  describe("GET /accounts/approvals/get", () => {
    it("returns 200 for valid params", async () => {
      const userAddress = "43CharacterStubApprovalGetAllAddress123456a";
      const approvalId1 = "43CharacterStubApprovalGetAllId123456789012";
      const approvalId2 = "43CharacterStubApprovalGetAllId123456789015";
      await dbTestHelper.insertStubUser({
        user_address: userAddress,
        winston_credit_balance: "1000",
      });

      const approvedAddress1 = "43CharacterStubApprovalGetAllApprovedAdd123";
      const approvedAddress2 = "43CharacterStubApprovalGetAllApprovedAdd523";

      await dbTestHelper.db.createDelegatedPaymentApproval({
        approvalDataItemId: approvalId1,
        payingAddress: userAddress,
        approvedAddress: approvedAddress1,
        approvedWincAmount: W(100),
      });

      await dbTestHelper.db.createDelegatedPaymentApproval({
        approvalDataItemId: approvalId2,
        payingAddress: userAddress,
        approvedAddress: approvedAddress2,
        approvedWincAmount: W(200),
      });

      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/get?userAddress=${userAddress}`
      );

      expect(status).to.equal(200);
      expect(statusText).to.equal("Approvals retrieved");
      expect(
        data.givenApprovals.map((a: DelegatedPaymentApproval) =>
          filterKeysFromObject(a, ["creationDate"])
        )
      ).to.deep.equal([
        {
          approvalDataItemId: approvalId1,
          approvedAddress: approvedAddress1,
          approvedWincAmount: "100",
          usedWincAmount: "0",
          payingAddress: userAddress,
        },
        {
          approvalDataItemId: approvalId2,
          approvedAddress: approvedAddress2,
          approvedWincAmount: "200",
          usedWincAmount: "0",
          payingAddress: userAddress,
        },
      ]);
    });

    it("returns 200 for valid params and no approvals found", async () => {
      const userAddress = "43CharacterStubApprovalGetAllAddress123456b";

      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/get?userAddress=${userAddress}`
      );

      expect(status).to.equal(200);
      expect(statusText).to.equal("Approvals retrieved");
      expect(data).to.deep.equal({
        givenApprovals: [],
        receivedApprovals: [],
      });
    });

    it("returns 400 for missing params", async () => {
      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/get`
      );

      expect(status).to.equal(400);
      expect(statusText).to.equal("Bad Request");
      expect(data).to.equal(
        "Malformed or missing required query parameter: userAddress"
      );
    });

    it("returns 503 for unexpected database errors", async () => {
      stub(paymentDatabase, "getAllApprovalsForUserAddress").throws(
        Error("Database error")
      );

      const { status, statusText, data } = await axios.get(
        `/v1/account/approvals/get?userAddress=${stubArweaveUserAddress}`
      );

      expect(status).to.equal(503);
      expect(statusText).to.equal("Service Unavailable");
      expect(data).to.equal("Database error");
    });
  });

  describe("POST /v1/arns/purchase/:intent/:name/:owner ", () => {
    it("rejects unauthorized access", async () => {
      const { status, statusText, data } = await axios.post(
        `/v1/arns/purchase/Buy-Name/testName`
      );
      expect(status).to.equal(401);
      expect(statusText).to.equal("Unauthorized");
      expect(data).to.equal("Signed request is required for this route");
    });

    it("rejects invalid intent", async () => {
      const { status, statusText, data } = await axios.post(
        `/v1/arns/purchase/invalidIntent/testName`,
        "",
        { headers: await signedRequestHeadersFromJwk(testArweaveWallet) }
      );

      expect(data).to.equal("Invalid intent parameter");
      expect(status).to.equal(400);
      expect(statusText).to.equal("Bad Request");
    });

    it("rejects buy-name intent with no processId present", async () => {
      const { status, statusText, data } = await axios.post(
        `/v1/arns/purchase/buy-name/testName?token=ethereum`,
        "",
        {
          headers: await signedRequestHeadersFromEthWallet(testEthereumWallet),
        }
      );

      expect(data).to.equal("Missing required parameter: processId");
      expect(status).to.equal(400);
      expect(statusText).to.equal("Bad Request");
    });

    it("rejects buy-name intent with no type present", async () => {
      const { status, statusText, data } = await axios.post(
        `/v1/arns/purchase/buy-name/testName?processId=stubProcessId`,
        "",
        { headers: await signedRequestHeadersFromJwk(testArweaveWallet) }
      );

      expect(data).to.equal(
        "Missing required parameter: type. Must be either 'permabuy' or 'lease'"
      );
      expect(status).to.equal(400);
      expect(statusText).to.equal("Bad Request");
    });

    it("succeeds for valid params and a stubbed ario gateway call", async () => {
      stub(gatewayMap.ario, "getTokenCost").resolves(new mARIOToken(100));
      stub(gatewayMap.ario, "initiateArNSPurchase").resolves({
        id: "stubbedId",
      });
      await dbTestHelper.insertStubUser({
        user_address: stubArweaveUserAddress,
        winston_credit_balance: "1000000000",
      });

      const { status, statusText, data } = await axios.post(
        `/v1/arns/purchase/Buy-Name/test-Name?type=permabuy&processId=stubProcessId`,
        "",
        { headers: await signedRequestHeadersFromJwk(testArweaveWallet) }
      );

      expect(status).to.equal(200);
      expect(statusText).to.equal("ArNS Purchase Successful");

      const { purchaseReceipt, arioWriteResult } = data;
      const {
        nonce,
        intent,
        name,
        owner,
        type,
        wincQty,
        mARIOQty,
        processId,
        createdDate,
      } = purchaseReceipt;

      expect(typeof nonce).to.equal("string");
      expect(intent).to.equal("Buy-Name");
      expect(name).to.equal("test-name");
      expect(owner).to.equal("-kYy3_LcYeKhtqNNXDN6xTQ7hW8S5EV0jgq_6j8a830");
      expect(type).to.equal("permabuy");
      expect(wincQty).to.equal("1139601");
      expect(mARIOQty).to.equal(100);
      expect(processId).to.equal("stubProcessId");
      expect(createdDate).to.exist;
      expect(arioWriteResult.id).to.equal("stubbedId");
    });
  });

  describe("GET /v1/arns/purchase/:nonce", () => {
    it("should return success status for valid purchase in the database", async () => {
      await dbTestHelper.insertStubArNSPurchase({
        nonce: "my-great-nonce",
      });

      const { status, statusText, data } = await axios.get(
        `/v1/arns/purchase/my-great-nonce`
      );

      expect(status).to.equal(200);
      expect(statusText).to.equal("Purchase status retrieved successfully");

      expect(data.nonce).to.equal("my-great-nonce");
      expect(data.messageId).to.equal("The Stubbiest Message");
      expect(data.status).to.equal("success");
    });

    it("should return failed status for failed purchase in the database", async () => {
      await dbTestHelper.insertStubFailedArNSPurchase({
        nonce: "failed-nonce",
      });
      const { status, statusText, data } = await axios.get(
        `/v1/arns/purchase/failed-nonce`
      );
      expect(status).to.equal(200);
      expect(statusText).to.equal("Purchase status retrieved successfully");

      expect(data.nonce).to.equal("failed-nonce");
      expect(data.messageId).to.equal("The Stubbiest Message");
      expect(data.status).to.equal("failed");
    });

    it("should return pending status for valid quote in the database", async () => {
      await dbTestHelper.insertStubArNSQuote({
        nonce: "my-great-pending-nonce",
      });

      const { status, statusText, data } = await axios.get(
        `/v1/arns/purchase/my-great-pending-nonce`
      );
      expect(status).to.equal(200);
      expect(statusText).to.equal("Purchase status retrieved successfully");

      expect(data.nonce).to.equal("my-great-pending-nonce");
      expect(data.status).to.equal("pending");
    });

    it("should return 400 for nonce not found", async () => {
      const { status, statusText, data } = await axios.get(
        `/v1/arns/purchase/invalid-nonce`
      );

      expect(status).to.equal(400);
      expect(statusText).to.equal("Bad Request");
      expect(data).to.equal("Purchase status not found");
    });
  });

  describe("GET /v1/arns/price/:intent/:name", () => {
    it("should succeed for valid params and a stubbed ario gateway call", async () => {
      stub(gatewayMap.ario, "getTokenCost").resolves(new mARIOToken(100));

      const { status, statusText, data } = await axios.get(
        `/v1/arns/price/Buy-Name/testName?type=permabuy`
      );

      expect(status).to.equal(200);
      expect(statusText).to.equal("OK");
      expect(data.mARIO).to.equal("100");
    });
  });

  describe("GET /v1/arns/quote/:method/:address/:currency/:intent/:name", () => {
    beforeEach(() => {
      stub(gatewayMap.ario, "getTokenCost").resolves(
        new ARIOToken(1000).toMARIO()
      );
      stub(gatewayMap.ario, "initiateArNSPurchase").resolves({
        id: "stubbedId",
      });
      stub(stripe.paymentIntents, "create").resolves(
        stripeResponseStub({
          ...paymentIntentStub({
            amount: 4256,
            status: "requires_payment_method",
          }),
        })
      );
    });

    it("should succeed for valid params and a stubbed ario gateway call", async () => {
      const { status, statusText, data } = await axios.get(
        `/v1/arns/quote/payment-intent/${stubArweaveUserAddress}/usd/Buy-Name/testName?type=permabuy&processId=stubProcessId`
      );

      expect(status).to.equal(200);
      expect(statusText).to.equal("OK");

      const {
        purchaseQuote: {
          mARIOQty,
          wincQty,
          paymentAmount,
          paymentProvider,
          intent,
          name,
          type,
          processId,
          owner,
          currencyType,
        },
        paymentSession: { amount, status: paymentStatus },
        fees,
      } = data;

      expect(mARIOQty).to.equal(1000000000);
      expect(wincQty).to.equal("14877299472599");
      expect(paymentAmount).to.equal(10444);
      expect(paymentProvider).to.equal("stripe");
      expect(intent).to.equal("Buy-Name");
      expect(name).to.equal("testname");
      expect(type).to.equal("permabuy");
      expect(processId).to.equal("stubProcessId");
      expect(owner).to.equal(stubArweaveUserAddress);
      expect(currencyType).to.equal("usd");
      expect(paymentStatus).to.equal("requires_payment_method");
      expect(paymentProvider).to.equal("stripe");
      expect(amount).to.equal(4256);

      expect(fees.length).to.equal(1);
    });

    it("should succeed with a valid promo code", async () => {
      const { status, statusText, data } = await axios.get(
        `/v1/arns/quote/payment-intent/${stubArweaveUserAddress}/usd/Buy-Name/testName?type=permabuy&processId=stubProcessId&promoCode=${routerTestPromoCode}`
      );

      expect(status).to.equal(200);
      expect(statusText).to.equal("OK");

      const {
        adjustments,
        purchaseQuote: { nonce, paymentAmount },
      } = data;

      expect(adjustments).to.exist;
      expect(adjustments.length).to.equal(1);
      expect(adjustments[0]).to.deep.equal({
        adjustmentAmount: -2089,
        currencyType: "usd",
        description: "",
        name: "Router Test Promo Code",
        operator: "multiply",
        operatorMagnitude: 0.8,
        promoCode: "routerTestPromoCode",
      });

      expect(nonce).to.exist;
      expect(nonce).to.be.a("string");
      expect(nonce.length).to.equal(36);
      expect(paymentAmount).to.equal(8355);
    });
  });
});

describe("Caching behavior tests", () => {
  let server: Server;

  const coinGeckoOracle = new CoingeckoTokenToFiatOracle();
  const tokenToFiatOracle = new ReadThroughTokenToFiatOracle({
    oracle: coinGeckoOracle,
  });
  const pricingService = new TurboPricingService({ tokenToFiatOracle });

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
      "getFiatPricesForOneToken"
    ).resolves(expectedTokenPrices);

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
      supportedFiatPaymentCurrencyTypes.map((currencyType) =>
        axios.get(
          `/v1/price/${currencyType}/${paymentAmountLimits[currencyType].maximumPaymentAmount}`
        )
      )
    );

    // Get minimum price for each supported currency concurrently
    await Promise.all(
      supportedFiatPaymentCurrencyTypes.map((currencyType) =>
        axios.get(
          `/v1/price/${currencyType}/${paymentAmountLimits[currencyType].minimumPaymentAmount}`
        )
      )
    );

    // We expect the pricing service spy to be called 10 times and twice for each supported currencies
    expect(pricingSpy.callCount).to.equal(
      10 + supportedFiatPaymentCurrencyTypes.length * 2
    );

    // But the CoinGecko oracle is only called the one time
    expect(coinGeckoStub.calledOnce).to.be.true;
  });
});
