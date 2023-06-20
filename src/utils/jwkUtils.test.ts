import { expect } from "chai";

import { testWallet } from "../../tests/helpers/testHelpers";
import { arweaveRSAModulusToAddress } from "./jwkUtils";

describe("jwkUtils", () => {
  it("returns the correct arweave address for arweave modulus", async () => {
    const address = await arweaveRSAModulusToAddress(testWallet.n);
    const expectedAddress = "-kYy3_LcYeKhtqNNXDN6xTQ7hW8S5EV0jgq_6j8a830";
    expect(address).to.equal(expectedAddress);
  });
});
