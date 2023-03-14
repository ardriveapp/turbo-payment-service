import axios from "axios";
import { expect } from "chai";
import { Server } from "http";

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

  it("GET /health returns 'OK' in the body, a 200 status, and the correct content-length", async () => {
    server = createServer({});

    const { status, statusText, headers, data } = await axios.get(
      localTestUrl + "/health"
    );

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    assertExpectedHeadersWithContentLength(headers, 2);

    expect(data).to.equal("OK");

    closeServer();
  });

  it("GET /price/bytes", async () => {
    server = createServer({});

    const { status, statusText, data } = await axios.get(
      `${localTestUrl}/v1/price/bytes/1024`
    );
    const arcPrice = Number(data);
    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    expect(arcPrice).to.be.a("number");

    closeServer();
  });

  it("GET /price/:currency/:value", async () => {
    server = createServer({});

    const { status, statusText, data } = await axios.get(
      `${localTestUrl}/v1/price/USD/100`
    );

    const arcAmount = Number(data);

    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    expect(arcAmount).to.be.a("number");
    closeServer();
  });

  it("GET /price/:currency/:value throws for invalid currency", async () => {
    server = createServer({});

    const { status } = await axios.get(
      `${localTestUrl}/v1/price/RandomCurrency/100`
    );

    expect(status).to.equal(502);

    closeServer();
  });
});
