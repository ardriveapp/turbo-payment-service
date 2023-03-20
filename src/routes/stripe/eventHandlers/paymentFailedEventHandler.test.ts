import * as chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";

import { paymentIntentFailedStub } from "../../../../tests/helpers/stubs";
import logger from "../../../logger";
import { handlePaymentFailedEvent } from "./paymentFailedEventHandler";

var expect = chai.expect;
chai.use(sinonChai);

describe("handlePaymentFailedEvent", () => {
  let sandbox: sinon.SinonSandbox;
  const mockDatabase = {
    expirePriceQuote: () => Promise.resolve({}),
    createRefundReceipt: () => Promise.resolve({}),
  };
  const mockCtx = {
    state: {
      paymentDatabase: mockDatabase,
    },
  };
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should log payment failed event and create refund receipt", async () => {
    const paymentIntent = paymentIntentFailedStub;

    const loggerInfoStub = sandbox.stub(logger, "info");
    const expirePriceQuoteStub = sandbox
      .stub(mockDatabase, "expirePriceQuote")
      .resolves({ walletAddress: "", balance: 10 });
    const createRefundReceiptStub = sandbox
      .stub(mockDatabase, "createRefundReceipt")
      .resolves({});

    await handlePaymentFailedEvent(paymentIntent, mockCtx as any);

    expect(loggerInfoStub).to.have.been.calledWith(
      `🔔  Webhook received for Wallet ${paymentIntent.metadata["address"]}: ${paymentIntent.status}!`
    );
    expect(loggerInfoStub).to.have.been.calledWith(
      `💸 Payment failed. ${paymentIntent.amount}`
    );
    expect(expirePriceQuoteStub).to.have.been.calledWith(
      paymentIntent.metadata["address"]
    );
    expect(createRefundReceiptStub).to.have.been.calledWith(
      paymentIntent.metadata["address"]
    );
  });
});
