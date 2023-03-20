import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { expect } from "chai";
import { Server } from "http";
import Stripe from "stripe";

import logger from "../src/logger";
import { createServer } from "../src/server";
import { assertExpectedHeadersWithContentLength } from "./helpers/testExpectations";
import { localTestUrl } from "./helpers/testHelpers";

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

  it("POST /stripe-webhook receives Stripe webhook event and returns 200 status", async () => {
    // Set up necessary environment variables
    process.env.STRIPE_SECRET_KEY = "your_stripe_secret_key";
    process.env.STRIPE_WEBHOOK_SECRET = "your_stripe_webhook_secret";

    const payload = {
      id: "evt_test_webhook",
      object: "event",
      created: 1650586663,
      data: {
        object: {
          id: "pi_test",
          object: "payment_intent",
          amount: 1000,
          currency: "usd",
          metadata: { address: "test_address" },
          status: "succeeded",
        },
      },
      type: "payment_intent.succeeded",
    };

    const payloadString = JSON.stringify(payload, null, 2);

    let stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2022-11-15",
      appInfo: {
        // For sample support and debugging, not required for production:
        name: "ardrive-turbo",
        version: "0.0.0",
      },
      typescript: true,
    });

    const header = stripe.webhooks.generateTestHeaderString({
      payload: payloadString,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });

    const event = stripe.webhooks.constructEvent(
      payloadString,
      header,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    try {
      const { status, statusText } = await axios.post(
        `${localTestUrl}/v1/stripe-webhook`,
        event,
        {
          headers: {
            "Content-Type": "application/json",
            "Stripe-Signature": header,
          },
        }
      );

      expect(status).to.equal(200);
      expect(statusText).to.equal("OK");
    } catch (error: any) {
      logger.error(error);
      throw new Error(`Test failed: ${error.message}`);
    }
  });
});
