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
  getPaymentQuote: () => Promise.resolve({}),
  createReceipt: () => Promise.resolve({}),
};

const mockCtx = {
  architecture: {
    pricingService: mockPricingService,
    paymentDatabase: mockDatabase,
  },
};

describe("handlePaymentSuccessEvent", () => {
  afterEach(() => {
    // reset the mocks after each test
    sinon.reset();
  });

  it("should process payment and create receipt if payment quote exists", async () => {
    const paymentIntent = paymentIntentStub;
    sinon.stub(mockDatabase, "getPaymentQuote").resolves({});
    sinon.stub(mockDatabase, "createReceipt").resolves({});
    sinon.stub(mockPricingService, "getARCForFiat").resolves("1.2345");

    await handlePaymentSuccessEvent(paymentIntent, mockCtx);

    expect(mockDatabase.getPaymentQuote).to.have.been.calledOnceWithExactly(
      paymentIntent.metadata["address"]
    );
    expect(mockDatabase.createReceipt).to.have.been.calledOnceWithExactly(
      paymentIntent.metadata["address"]
    );
    expect(mockPricingService.getARCForFiat).to.have.been.calledOnceWithExactly(
      paymentIntent.currency,
      paymentIntent.amount
    );
  });

  it("should throw an error if no payment quote is found", async () => {
    const paymentIntent = paymentIntentStub;
    sinon.stub(mockDatabase, "getPaymentQuote").resolves(undefined);
    try {
      await handlePaymentSuccessEvent(paymentIntent, mockCtx);
      expect.fail("No payment quote found for 0x1234567890");
    } catch (error) {
      expect(error).to.exist;
    }
  });
});
