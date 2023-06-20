import { expect } from "chai";

import { testWallet } from "../../tests/helpers/testHelpers";
import { publicKeyToAddress } from "./jwkUtils";

describe("jwkUtils", () => {
  it("returns the correct address for key", async () => {
    const address = await publicKeyToAddress(testWallet.n);
    const expectedAddress = "-kYy3_LcYeKhtqNNXDN6xTQ7hW8S5EV0jgq_6j8a830";
    expect(address).to.equal(expectedAddress);
  });
});
