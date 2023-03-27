import * as chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";

import { chargeDisputeStub } from "../../../../tests/helpers/stubs";
import { PostgresDatabase } from "../../../database/postgres";
import { handleDisputeCreatedEvent } from "./disputeCreatedEventHandler";

var expect = chai.expect;
chai.use(sinonChai);

describe("handleDisputeCreatedEvent", () => {
  let sandbox: sinon.SinonSandbox;
  const mockDatabase = new PostgresDatabase();

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  //TODO: integrate with db
  it.skip("should capture the dispute created event, update balance, and create refund receipt", async () => {
    const dispute = chargeDisputeStub;
    const walletAddress = dispute.metadata["address"];
    const getPaymentReceiptStub = sinon
      .stub(mockDatabase, "getPaymentReceipt")
      .resolves();
    const createChargebackReceiptStub = sinon
      .stub(mockDatabase, "createChargebackReceipt")
      .resolves();

    await handleDisputeCreatedEvent(dispute, mockDatabase);

    expect(getPaymentReceiptStub).to.have.been.calledWith(walletAddress);
    expect(createChargebackReceiptStub).to.have.been.calledWith(walletAddress);
  });
});
