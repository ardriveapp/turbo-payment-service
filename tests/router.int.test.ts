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

  it("POST /price/bytes", async () => {
    server = createServer({});

    console.log("localTestUrl", `${localTestUrl}/v1/price/bytes/1024`);
    const { status, statusText, headers, data } = await axios.post(
      `${localTestUrl}/v1/price/bytes/1024`
    );

    console.log("status", status);
    expect(status).to.equal(200);
    expect(statusText).to.equal("OK");

    assertExpectedHeadersWithContentLength(headers, 2);
    console.log("data", data);
    expect(data).to.equal(32479329);

    closeServer();
  });
});
