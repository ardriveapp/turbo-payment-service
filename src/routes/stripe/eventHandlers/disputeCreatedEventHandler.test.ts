import * as chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";

import { chargeDisputeStub } from "../../../../tests/helpers/stubs";
import { TestDatabase } from "../../../database/database";
import { handleDisputeCreatedEvent } from "./disputeCreatedEventHandler";

var expect = chai.expect;
chai.use(sinonChai);

describe("handleDisputeCreatedEvent", () => {
  let sandbox: sinon.SinonSandbox;
  const mockDatabase = new TestDatabase();

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should capture the dispute created event, update balance, and create refund receipt", async () => {
    const dispute = chargeDisputeStub;
    const walletAddress = dispute.metadata["address"];
    const disputeAmount = dispute.amount;
    const userBalance = 1000;
    const expirePriceQuoteStub = sandbox
      .stub(mockDatabase, "expirePriceQuote")
      .resolves({ walletAddress: walletAddress, balance: disputeAmount });
    const getPaymentReceiptStub = sandbox
      .stub(mockDatabase, "getPaymentReceipt")
      .resolves({ walletAddress: walletAddress, balance: disputeAmount });
    const getUserBalanceStub = sandbox
      .stub(mockDatabase, "getUserBalance")
      .resolves({ walletAddress: walletAddress, balance: userBalance });
    const updateUserBalanceStub = sandbox
      .stub(mockDatabase, "updateUserBalance")
      .resolves({
        walletAddress: walletAddress,
        balance: userBalance - disputeAmount,
      });
    const createRefundReceiptStub = sandbox
      .stub(mockDatabase, "createRefundReceipt")
      .resolves({ walletAddress: walletAddress, balance: disputeAmount });

    await handleDisputeCreatedEvent(dispute, mockDatabase);

    expect(expirePriceQuoteStub).to.have.been.calledWith(walletAddress);
    expect(getPaymentReceiptStub).to.have.been.calledWith(walletAddress);
    expect(getUserBalanceStub).to.have.been.calledWith(walletAddress);
    expect(updateUserBalanceStub).to.have.been.calledWith(
      walletAddress,
      userBalance - disputeAmount
    );
    expect(createRefundReceiptStub).to.have.been.calledWith(walletAddress);
  });
});
