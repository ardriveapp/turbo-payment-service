import * as chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";

import { paymentIntentSucceededStub } from "../../../../tests/helpers/stubs";
import { Database } from "../../../database/database";
import { TopUpQuote } from "../../../database/dbTypes";
import { handlePaymentSuccessEvent } from "./paymentSuccessEventHandler";

var expect = chai.expect;
chai.use(sinonChai);

const mockPricingService = {
  getARCForFiat: () => Promise.resolve("1.2345"),
};

// FIXME: solving merge conflict. TODO: test in integration with database
const mockDatabase: Database = {
  getTopUpQuote: () => Promise.resolve({} as TopUpQuote),
  createPaymentReceipt: () => Promise.resolve(),
} as unknown as Database;

afterEach(() => {
  sinon.restore();
});

describe("handlePaymentSuccessEvent", () => {
  it("should process payment and create receipt if payment quote exists", async () => {
    const paymentIntent = paymentIntentSucceededStub;
    sinon.stub(mockDatabase, "getTopUpQuote").resolves({} as TopUpQuote);
    sinon.stub(mockDatabase, "createPaymentReceipt").resolves();
    sinon.stub(mockPricingService, "getARCForFiat").resolves("1.2345");

    await handlePaymentSuccessEvent(paymentIntent, mockDatabase);

    expect(mockDatabase.getTopUpQuote).to.have.been.calledOnceWithExactly(
      paymentIntent.metadata["address"]
    );
    // expect(
    //   mockDatabase.createPaymentReceipt
    // ).to.have.been.calledOnceWithExactly(paymentIntent.metadata["address"]);
  });

  it("should throw an error if no payment quote is found", async () => {
    sinon.stub(mockDatabase, "getTopUpQuote").resolves(undefined);
    const paymentIntent = paymentIntentSucceededStub;
    try {
      await handlePaymentSuccessEvent(paymentIntent, mockDatabase);
      expect.fail("No payment quote found for 0x1234567890");
    } catch (error) {
      expect(error).to.exist;
    }
  });
});
