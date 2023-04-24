import Arweave from "arweave/node/common";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { expect } from "chai";
import { Server } from "http";
import { sign } from "jsonwebtoken";

import { PostgresDatabase } from "../src/database/postgres";
import logger from "../src/logger";
import { createServer } from "../src/server";
import { toB64Url } from "../src/utils/base64";
import { jwkToPem } from "../src/utils/pem";
import { DbTestHelper } from "./dbTestHelper";
import { signData } from "./helpers/signData";
import { assertExpectedHeadersWithContentLength } from "./helpers/testExpectations";
import { localTestUrl, testWallet } from "./helpers/testHelpers";

describe("Router tests", () => {
  let server: Server;

  function closeServer() {
    server.close();
    logger.info("Server closed!");
  }

  let mock: MockAdapter;
  let secret: string;
  beforeEach(async () => {
    process.env.PRIVATE_ROUTE_SECRET ??= "secret";
    secret = process.env.PRIVATE_ROUTE_SECRET;
    server = await createServer({});
    mock = new MockAdapter(axios, { onNoMatch: "passthrough" });
  });

  afterEach(() => {
    mock.restore();
    closeServer();
  });

  it("GET /health returns 'OK' in the body, a 200 status, and the correct content-length", async () => {
    const { status, statusText, headers, data } = await axios.get(
      localTestUrl + "/health"
    );

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    assertExpectedHeadersWithContentLength(headers, 2);

    expect(data).to.equal("OK");
  });

  it("GET /price/bytes", async () => {
    mock.onGet("arweave.net/price/1024").reply(200, "100");

    const { status, statusText, data } = await axios.get(
      `${localTestUrl}/v1/price/bytes/1024`
    );
    const arcPrice = Number(data);
    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    expect(arcPrice).to.be.a("number");
  });

  it("GET /price/bytes returns 400 for bytes > max safe integer", async () => {
    const { status, statusText } = await axios.get(
      `${localTestUrl}/v1/price/bytes/1024000000000000000000000000000000000000000000`,
      {
        validateStatus: () => true,
      }
    );
    expect(status).to.equal(400);
    expect(statusText).to.equal("Byte count too large");
  });

  it("GET /price/:currency/:value", async () => {
    mock
      .onGet(
        "https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd"
      )
      .reply(200, {
        arweave: {
          usd: 10,
        },
      });

    const { status, statusText, data } = await axios.get(
      `${localTestUrl}/v1/price/USD/100`
    );

    const arcAmount = Number(data);

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    expect(arcAmount).to.be.a("number");
  });

  it("GET /price/:currency/:value returns 502 for invalid currency", async () => {
    //Coingecko returns 200 and empty arweave object for invalid currency

    mock
      .onGet(
        "https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=RandomCurrency"
      )
      .reply(200, { arweave: {} });

    const { data, status, statusText } = await axios.get(
      `${localTestUrl}/v1/price/RandomCurrency/100`,
      {
        // stop axios from throwing an error for 502
        validateStatus: () => true,
      }
    );
    expect(data).to.equal(
      "The currency type 'randomcurrency' is currently not supported by this API!"
    );
    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
  });

  before(async () => {
    await new DbTestHelper(new PostgresDatabase()).insertStubUser({
      user_address: "-kYy3_LcYeKhtqNNXDN6xTQ7hW8S5EV0jgq_6j8a830",
      winston_credit_balance: "5000",
    });
  });

  it("GET /balance returns 200 for correct signature", async () => {
    const nonce = "123";
    const publicKey = toB64Url(Buffer.from(jwkToPem(testWallet, true)));
    const signature = await signData(jwkToPem(testWallet), nonce);

    const { status, statusText, data } = await axios.get(
      `${localTestUrl}/v1/balance`,
      {
        headers: {
          "x-public-key": publicKey,
          "x-nonce": nonce,
          "x-signature": toB64Url(Buffer.from(signature)),
        },
      }
    );

    const balance = Number(data);

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    expect(balance).to.equal(5000);
  });

  it("GET /balance returns 404 for no user found", async function () {
    this.timeout(5_000);
    const jwk = await Arweave.crypto.generateJWK();

    const nonce = "123";
    const publicKey = toB64Url(Buffer.from(jwkToPem(jwk, true)));
    const signature = await signData(jwkToPem(jwk), nonce);

    const { status, statusText, data } = await axios.get(
      `${localTestUrl}/v1/balance`,
      {
        headers: {
          "x-public-key": publicKey,
          "x-nonce": nonce,
          "x-signature": toB64Url(Buffer.from(signature)),
        },
        validateStatus: () => true,
      }
    );

    expect(status).to.equal(404);
    expect(statusText).to.equal("Not Found");

    expect(data).to.equal("User Not Found");
  });

  it("GET /balance returns 403 for bad signature", async () => {
    const nonce = "123";
    const publicKey = toB64Url(Buffer.from(jwkToPem(testWallet, true)));
    const signature = await signData(jwkToPem(testWallet), "another nonce");

    const { status, data, statusText } = await axios.get(
      `${localTestUrl}/v1/balance`,
      {
        headers: {
          "x-public-key": publicKey,
          "x-nonce": nonce,
          "x-signature": toB64Url(Buffer.from(signature)),
        },
        validateStatus: () => true,
      }
    );

    expect(status).to.equal(403);
    expect(statusText).to.equal("Forbidden");

    expect(data).to.equal("Invalid signature or missing required headers");
  });

  it("GET /top-up/checkout-session returns 200 and correct response for correct signature", async () => {
    mock
      .onGet(
        "https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd"
      )
      .reply(200, {
        arweave: {
          usd: 10,
        },
      });

    const { status, statusText, data } = await axios.get(
      `${localTestUrl}/v1/top-up/checkout-session/-kYy3_LcYeKhtqNNXDN6xTQ7hW8S5EV0jgq_6j8a830/usd/100`
    );

    expect(data).to.have.property("balance");
    expect(data).to.have.property("topUpQuote");
    expect(data).to.have.property("paymentSession");
    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    const { object, payment_method_types, amount_total, url } =
      data.paymentSession;

    expect(object).to.equal("checkout.session");
    expect(payment_method_types).to.deep.equal(["card"]);
    expect(amount_total).to.equal(100);
    expect(url).to.be.a.string;
  });

  it("GET /top-up/payment-intent returns 200 and correct response for correct signature", async () => {
    mock
      .onGet(
        "https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd"
      )
      .reply(200, {
        arweave: {
          usd: 10,
        },
      });

    const { status, statusText, data } = await axios.get(
      `${localTestUrl}/v1/top-up/payment-intent/-kYy3_LcYeKhtqNNXDN6xTQ7hW8S5EV0jgq_6j8a830/usd/100`
    );

    expect(data).to.have.property("balance");
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
    expect(amount).to.equal(100);
    expect(currency).to.equal("usd");
    expect(client_secret).to.be.a.string;
    expect(metadata.topUpQuoteId).to.be.a.string;
    expect(paymentStatus).to.equal("requires_payment_method");
  });

  it("GET /top-up/checkout-session returns 403 for bad arweave address", async () => {
    mock
      .onGet(
        "https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd"
      )
      .reply(200, {
        arweave: {
          usd: 10,
        },
      });

    const { status, data } = await axios.get(
      `${localTestUrl}/v1/top-up/checkout-session/BAD_ADDRESS_OF_DOOM/usd/100`,
      {
        validateStatus: () => true,
      }
    );
    expect(status).to.equal(403);
    expect(data).to.equal(
      "Destination address is not a valid Arweave native address!"
    );
  });

  it("GET /top-up/checkout-session returns 400 for correct signature but invalid currency", async () => {
    mock
      .onGet(
        "https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd"
      )
      .reply(200, {
        arweave: {
          usd: 10,
        },
      });

    const { status, data, statusText } = await axios.get(
      `${localTestUrl}/v1/top-up/checkout-session/-kYy3_LcYeKhtqNNXDN6xTQ7hW8S5EV0jgq_6j8a830/currencyThatDoesNotExist/100`,
      {
        validateStatus: () => true,
      }
    );

    expect(data).to.equal(
      "The currency type 'currencythatdoesnotexist' is currently not supported by this API!"
    );
    expect(status).to.equal(400);
    expect(statusText).to.equal("Bad Request");
  });

  it("GET /reserve-balance returns 200 for correct params", async () => {
    const testAddress = "-kYy3_LcYeKhtqNNXDN6xTQ7hW8S5EV0jgq_6j8a830";
    const winstonCredits = 1000;
    const token = sign({}, secret, {
      expiresIn: "1h",
    });

    const { status, statusText } = await axios.get(
      `${localTestUrl}/v1/reserve-balance/${testAddress}/${winstonCredits}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(statusText).to.equal("Balance reserved");
    expect(status).to.equal(200);
  });

  it("GET /reserve-balance returns 401 for missing authorization", async () => {
    const testAddress = "-kYy3_LcYeKhtqNNXDN6xTQ7hW8S5EV0jgq_6j8a830";
    const winstonCredits = 1000;

    const { status, statusText } = await axios.get(
      `${localTestUrl}/v1/reserve-balance/${testAddress}/${winstonCredits}`,
      {
        validateStatus: () => true,
      }
    );
    expect(statusText).to.equal("Unauthorized");
    expect(status).to.equal(401);
  });

  it("GET /reserve-balance returns 403 for insufficient balance", async () => {
    const testAddress = "-kYy3_LcYeKhtqNNXDN6xTQ7hW8S5EV0jgq_6j8a830";
    const winstonCredits = 100000;
    const token = sign({}, secret, {
      expiresIn: "1h",
    });

    const { status, statusText } = await axios.get(
      `${localTestUrl}/v1/reserve-balance/${testAddress}/${winstonCredits}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        validateStatus: () => true,
      }
    );
    expect(statusText).to.equal("Insufficient balance");
    expect(status).to.equal(403);
  });

  it("GET /reserve-balance returns 403 if user not found", async () => {
    const testAddress = "someRandomAddress";
    const winstonCredits = 100000;

    const token = sign({}, secret, {
      expiresIn: "1h",
    });

    const { status, statusText } = await axios.get(
      `${localTestUrl}/v1/reserve-balance/${testAddress}/${winstonCredits}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        validateStatus: () => true,
      }
    );
    expect(statusText).to.equal("User not found");
    expect(status).to.equal(403);
  });

  it("GET /refund-balance returns 200 for correct params", async () => {
    const testAddress = "-kYy3_LcYeKhtqNNXDN6xTQ7hW8S5EV0jgq_6j8a830";
    const winstonCredits = 1000;
    const token = sign({}, secret, {
      expiresIn: "1h",
    });

    const { status, statusText } = await axios.get(
      `${localTestUrl}/v1/refund-balance/${testAddress}/${winstonCredits}`,
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
    const testAddress = "-kYy3_LcYeKhtqNNXDN6xTQ7hW8S5EV0jgq_6j8a830";
    const winstonCredits = 1000;

    const { status, statusText } = await axios.get(
      `${localTestUrl}/v1/refund-balance/${testAddress}/${winstonCredits}`,
      {
        validateStatus: () => true,
      }
    );
    expect(statusText).to.equal("Unauthorized");
    expect(status).to.equal(401);
  });

  it("GET /refund-balance returns 403 if user not found", async () => {
    const testAddress = "someRandomAddress";
    const winstonCredits = 100000;
    const token = sign({}, secret, {
      expiresIn: "1h",
    });

    const { status, statusText } = await axios.get(
      `${localTestUrl}/v1/refund-balance/${testAddress}/${winstonCredits}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        validateStatus: () => true,
      }
    );
    expect(statusText).to.equal("User not found");
    expect(status).to.equal(403);
  });
});
