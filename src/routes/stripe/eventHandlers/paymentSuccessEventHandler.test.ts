import * as chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";

import { paymentIntentSucceededStub } from "../../../../tests/helpers/stubs";
import { handlePaymentSuccessEvent } from "./paymentSuccessEventHandler";

var expect = chai.expect;
chai.use(sinonChai);

const mockPricingService = {
  getARCForFiat: () => Promise.resolve("1.2345"),
};

const mockDatabase = {
  getPriceQuote: () => Promise.resolve({}),
  createPaymentReceipt: () => Promise.resolve({}),
};

const mockCtx = {
  state: {
    pricingService: mockPricingService,
    paymentDatabase: mockDatabase,
  },
};

afterEach(() => {
  sinon.restore();
});

describe("handlePaymentSuccessEvent", () => {
  it("should process payment and create receipt if payment quote exists", async () => {
    const paymentIntent = paymentIntentSucceededStub;
    sinon
      .stub(mockDatabase, "getPriceQuote")
      .resolves({ walletAddress: "", balance: 10 });
    sinon.stub(mockDatabase, "createPaymentReceipt").resolves({});
    sinon.stub(mockPricingService, "getARCForFiat").resolves("1.2345");

    await handlePaymentSuccessEvent(paymentIntent, mockCtx as any);

    expect(mockDatabase.getPriceQuote).to.have.been.calledOnceWithExactly(
      paymentIntent.metadata["address"]
    );
    expect(
      mockDatabase.createPaymentReceipt
    ).to.have.been.calledOnceWithExactly(paymentIntent.metadata["address"]);
  });

  it("should throw an error if no payment quote is found", async () => {
    const paymentIntent = paymentIntentSucceededStub;
    sinon.stub(mockDatabase, "getPriceQuote").resolves(undefined);
    try {
      await handlePaymentSuccessEvent(paymentIntent, mockCtx as any);
      expect.fail("No payment quote found for 0x1234567890");
    } catch (error) {
      expect(error).to.exist;
    }
  });
});
