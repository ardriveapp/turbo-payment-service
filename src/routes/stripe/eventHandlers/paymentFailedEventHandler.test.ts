import * as chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";

import { paymentIntentFailedStub } from "../../../../tests/helpers/stubs";
import { handlePaymentFailedEvent } from "./paymentFailedEventHandler";

var expect = chai.expect;
chai.use(sinonChai);

describe("handlePaymentFailedEvent", () => {
  let sandbox: sinon.SinonSandbox;
  const mockDatabase = {
    expireTopUpQuote: () => Promise.resolve({}),
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

  // TODO: Integrate with test db
  it.skip("should capture the payment failed event and create refund receipt", async () => {
    const paymentIntent = paymentIntentFailedStub;

    const expirePriceQuoteStub = sandbox
      .stub(mockDatabase, "expireTopUpQuote")
      .resolves({ walletAddress: "", balance: 10 });
    const createRefundReceiptStub = sandbox
      .stub(mockDatabase, "createRefundReceipt")
      .resolves({});

    await handlePaymentFailedEvent(paymentIntent, mockCtx as any);

    expect(expirePriceQuoteStub).to.have.been.calledWith(
      paymentIntent.metadata["address"]
    );
    expect(createRefundReceiptStub).to.have.been.calledWith(
      paymentIntent.metadata["address"]
    );
  });
});
