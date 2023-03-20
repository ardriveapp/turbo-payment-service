import * as chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";

import { chargeDisputeStub } from "../../../../tests/helpers/stubs";
import logger from "../../../logger";
import { handleDisputeCreatedEvent } from "./disputeCreatedEventHandler";

var expect = chai.expect;
chai.use(sinonChai);

describe("handleDisputeCreatedEvent", () => {
  let sandbox: sinon.SinonSandbox;
  const mockDatabase = {
    expirePriceQuote: () => Promise.resolve({}),
    createRefundReceipt: () => Promise.resolve({}),

    getUserBalance: () => Promise.resolve({}),
    updateUserBalance: () => Promise.resolve({}),
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

  it("should log dispute created event, update balance, and create refund receipt", async () => {
    const dispute = chargeDisputeStub;

    const loggerInfoStub = sandbox.stub(logger, "info");
    const expirePriceQuoteStub = sandbox
      .stub(mockDatabase, "expirePriceQuote")
      .resolves({ balance: 500 });
    const getUserBalanceStub = sandbox
      .stub(mockDatabase, "getUserBalance")
      .resolves({ balance: 1000 });
    const updateUserBalanceStub = sandbox
      .stub(mockDatabase, "updateUserBalance")
      .resolves({ balance: 500 });
    const createRefundReceiptStub = sandbox
      .stub(mockDatabase, "createRefundReceipt")
      .resolves({});

    await handleDisputeCreatedEvent(dispute, mockCtx as any);

    expect(loggerInfoStub).to.have.been.calledWith(
      `🔔  Webhook received for Wallet ${dispute.metadata["address"]}: ${dispute.status}!`
    );
    expect(loggerInfoStub).to.have.been.calledWith(
      `💸 Payment failed. ${dispute.amount}`
    );
    expect(expirePriceQuoteStub).to.have.been.calledWith(
      dispute.metadata["address"]
    );
    expect(getUserBalanceStub).to.have.been.calledWith(
      dispute.metadata["address"]
    );
    expect(updateUserBalanceStub).to.have.been.calledWith(
      dispute.metadata["address"],
      500
    );
    expect(createRefundReceiptStub).to.have.been.calledWith(
      dispute.metadata["address"]
    );
  });
});
