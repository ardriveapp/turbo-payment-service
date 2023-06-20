import { expect } from "chai";

import { publicKeyToHeader, testWallet } from "../../tests/helpers/testHelpers";
import { jwkInterfaceToPublicKey } from "../types/jwkTypes";
import { publicKeyToAddress } from "./jwkUtils";

describe("jwkUtils", () => {
  it("returns the correct address for key", async () => {
    const publicKey = jwkInterfaceToPublicKey(testWallet);
    const address = await publicKeyToAddress(publicKey);
    const expectedAddress = "-kYy3_LcYeKhtqNNXDN6xTQ7hW8S5EV0jgq_6j8a830";
    expect(address).to.equal(expectedAddress);
  });

  it("encodes a public key to a string header", () => {
    const publicKey = jwkInterfaceToPublicKey(testWallet);
    const expectedHeader =
      "eyJrdHkiOiJSU0EiLCJuIjoiaTBWM2VqZmMyWkZGUnB0eng1VHg4U2hXdE85TFR2dW51cU1iZ3F5bXZNTlBqdEZXaTZweWc2eFRJbDBxTDR4YjVEdHYtNU84R080bGZObjVtUERuQ2ZOR0lyY1kwVE84MkhIOENWVDVnMktzWnpCZWNfWGpqeHdLZVJtb1l6TUIySnhDQnpNbTVrVmhVUk45OFZ6OF9hRVRsVTBKRGJXZE9zRGNWc1RXa19mUG15dS1CbzNLUVZCOVg4bzlFZ3lTVmw5Q0Q5RmlBQU1Rc1JqT2hlMkFDenFxaWFFT3JhVFpQdEE1M1IzTGRlSFJDM1Mwbm8xVXgtXzRUNWhpc1BsU1JYcko1T0ZwelFLaXpNRVE4X0hudzNRQUIxS1JnZEJLWWQzNFNsUVdIRjNiRHVrXzVtMW5XWXVzSUo5MkdOeFB1TzFpYzZBWktwV2daRUMzYjQtcXd2Sm1oUWZCQjc5eU52eE1MeXZhdjFrMnJDVXpFeTItdEE1RFN5S1R3T3VaaU5OeDlhbnBhYlF4aUE3amVYZ2xrNHE4REdKOGtMTW9pY0czWGlTc3dCX2E3dTJjTlNrYlNxT3pWNjVfdGg3MWpWZlJwTHBYUnFGdXEtSDBxbUFnQThpd2VTemQtWXNPcFZ4c0dnT09RWEpPUllmRFJ3UHBrNDRSdVFiR1l6cWNWamZFYzhSMi1Oa25kSmIzbGdBMWxjVWtHZ3JCVGNiLWoxWHYtd1Ewd2puSjN6QmJ2TTRsTmdFYzRPajZhWkQ3MTVzcEM3Yl9GQjdEWVFOdVV6WHBEbERxcUg4dXZULVZ0LXpfVURuOXFzZTVkWEpCazRwNU40UVlrSER0OUpZeU5wbFVsdWZRbEh6SlR1al9mWndCRF8taFJkY21yWmFpZmpIVTRoYWdDVTgiLCJlIjoiQVFBQiJ9";
    expect(publicKeyToHeader(publicKey)).to.equal(expectedHeader);
  });
});
