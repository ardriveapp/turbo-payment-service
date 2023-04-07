import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { expect } from "chai";
import { Server } from "http";

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
  beforeEach(async () => {
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

    const { status } = await axios.get(
      `${localTestUrl}/v1/price/RandomCurrency/100`,
      {
        // stop axios from throwing an error for 502
        validateStatus: () => true,
      }
    );
    expect(status).to.equal(502);
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

  it("GET /balance returns 403 for bad signature", async () => {
    const nonce = "123";
    const publicKey = toB64Url(Buffer.from(jwkToPem(testWallet, true)));
    const signature = await signData(jwkToPem(testWallet), "another nonce");

    const { status, data } = await axios.get(`${localTestUrl}/v1/balance`, {
      headers: {
        "x-public-key": publicKey,
        "x-nonce": nonce,
        "x-signature": toB64Url(Buffer.from(signature)),
      },
      validateStatus: () => true,
    });

    expect(data).to.equal("Invalid signature or missing required headers");
    expect(status).to.equal(403);
  });

  it("GET /price-quote returns 200 and correct response for correct signature", async () => {
    const nonce = "123";
    const publicKey = toB64Url(Buffer.from(jwkToPem(testWallet, true)));
    const signature = await signData(jwkToPem(testWallet), nonce);

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
      `${localTestUrl}/v1/price-quote/usd/100`,
      {
        headers: {
          "x-public-key": publicKey,
          "x-nonce": nonce,
          "x-signature": toB64Url(Buffer.from(signature)),
        },
      }
    );

    expect(data).to.have.property("balance");
    expect(data).to.have.property("priceQuote");
    expect(data).to.have.property("paymentIntent");
    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");
  });

  it("GET /price-quote returns 403 for bad signature", async () => {
    const nonce = "123";
    const publicKey = toB64Url(Buffer.from(jwkToPem(testWallet, true)));
    const signature = await signData(jwkToPem(testWallet), "somethingElse");

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
      `${localTestUrl}/v1/price-quote/usd/100`,
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
    expect(data).to.equal("Wallet address not provided");
  });

  it("GET /price-quote returns 400 for correct signature but invalid currency", async () => {
    const nonce = "123";
    const publicKey = toB64Url(Buffer.from(jwkToPem(testWallet, true)));
    const signature = await signData(jwkToPem(testWallet), nonce);

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
      `${localTestUrl}/v1/price-quote/currencyThatDoesNotExist/100`,
      {
        headers: {
          "x-public-key": publicKey,
          "x-nonce": nonce,
          "x-signature": toB64Url(Buffer.from(signature)),
        },
        validateStatus: () => true,
      }
    );
    expect(status).to.equal(400);
    expect(data).to.equal("ArweaveToFiat Oracle Error");
  });
});
