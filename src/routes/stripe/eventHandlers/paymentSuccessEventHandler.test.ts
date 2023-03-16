import * as chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";

import { paymentIntentStub } from "../../../../tests/helpers/stubs";
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
  architecture: {
    pricingService: mockPricingService,
    paymentDatabase: mockDatabase,
  },
};

describe("handlePaymentSuccessEvent", () => {
  it("should process payment and create receipt if payment quote exists", async () => {
    const paymentIntent = paymentIntentStub;
    sinon.stub(mockDatabase, "getPriceQuote").resolves({});
    sinon.stub(mockDatabase, "createPaymentReceipt").resolves({});
    sinon.stub(mockPricingService, "getARCForFiat").resolves("1.2345");

    await handlePaymentSuccessEvent(paymentIntent, mockCtx);

    expect(mockDatabase.getPriceQuote).to.have.been.calledOnceWithExactly(
      paymentIntent.metadata["address"]
    );
    expect(
      mockDatabase.createPaymentReceipt
    ).to.have.been.calledOnceWithExactly(paymentIntent.metadata["address"]);
    expect(mockPricingService.getARCForFiat).to.have.been.calledOnceWithExactly(
      paymentIntent.currency,
      paymentIntent.amount
    );
  });

  it("should throw an error if no payment quote is found", async () => {
    const paymentIntent = paymentIntentStub;
    sinon.stub(mockDatabase, "getPriceQuote").resolves(undefined);
    try {
      await handlePaymentSuccessEvent(paymentIntent, mockCtx);
      expect.fail("No payment quote found for 0x1234567890");
    } catch (error) {
      expect(error).to.exist;
    }
  });
});
