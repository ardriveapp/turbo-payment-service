/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { fromB64Url } from "@ar.io/sdk";
import { expect } from "chai";

import { toB64Url } from "../../src/utils/base64";
import { signEthereumData } from "../../src/utils/verifyArweaveSignature";
import {
  signArweaveData,
  signedRequestHeadersFromJwk,
} from "../../tests/helpers/signData";
import {
  testArweaveWallet,
  testEthereumWallet,
} from "../../tests/helpers/testHelpers";

describe("signData", () => {
  it("snapshot test for signing data with JWK", async () => {
    const signature = await signArweaveData(testArweaveWallet, "123");
    const expectedSignature =
      "E0LcK9s6-RlidqtMz0bIYaIYzhGfKFrKNHC3wPeuKFju5XPU4vFJBM-mv-Fh-9T99joSOl37taWWzfVUemuHTgPVZputEEM5tNj1Neao_C1ssoAvJeVfAuEaZGPWPjanpVOCv1JpA8BD0C1IkGHaCNr8ajMt-CmfwKllaZ5xFEP3C6dp2REmr5P0wcefLYWwPcdFMvScz_dotWYurDctWtrxxm2E6gkbLkQSgyGa5mBkzP31evV6j0bXOzmtnE_jS4tuwVs6E8i0vzrRlHk1gq0YUtAhKs2s4FBbnsVxLBuSQGEL9s4geQo_NOCEPKVPlsUYcg8Q0acmNTXJWsZJRqQsNR0qnN5HM9yZO2LW-899UayVY4nUDU2urLDoXr9FiLKtPKdtPX0YGMx9xgpDSXMZ-vyuicTZLZbd8zGft82tFHU-yqK5xn2K96FY6RRhWamRmanwgRV8ISvVsEQ57TppGWgWNGIzX0ZmtU8rc11bncG2adACzqmfa9FBV4h2oWAHjpkvYprK2cTapEoC6SMhNeDTPRHb2zCDkHI5j__yr0w24HZYGGxp70Tfnk4XhbeINREVCydofoc1PD9B3frLqKYbwik0JNVsdEI56z4F_YuSCfmmOvXqfDB32BHjmt28KM-Rdb_9mblOejfSjPz-xpFRPmT0WLClR9JLiE4";

    expect(toB64Url(Buffer.from(signature))).to.equal(expectedSignature);
  });

  describe("signedRequestHeadersFromJwk", () => {
    it("should create correct headers for signed data", async () => {
      const data = "123";
      const nonce = "a-not-so-random-nonce";
      const signedData = await signArweaveData(testArweaveWallet, data + nonce);
      const signedHeaders = await signedRequestHeadersFromJwk(
        testArweaveWallet,
        nonce,
        data
      );
      const expectedSignature =
        "VhU82Tj8L08xdXO9JYj3eWd6kus55PJ5LXGoabyEBW5vLWeeXPJSFq6o6YFMVFPl9XhwcU7ZqSHH6i2l57hN9Ot9w5nT2PsRgt-KakX-ahaMMGZEUAWcK53BzCWESXI8yFZqxq4KTNeXzfqTRO1ALrHqNBddB4gbnsRRErDNTNDTKKfcbfl1cFjPRgmDSn03RCA1hiT3lWjC6zhV4lHvEDYAZczekQQXrnwuLsHdpvtlRw-LH-LSYc27j8EA5Qvfli04OnLXsd98Vkf-UpWmEeQTiQhf3j-tuXX_t4ZD-cm1wxZd1oe4xRlw0dPN0xC2DnPSVXXBZyv-QaWS3c7Yi-0whtwPPtrEeZouRgTuxNTK8rD5fyvmx4CDhmNdLjQCG2CBDHmxRc8qUW2QfY4Bl8mKD50lY-wlu2ChbeeayOZCwbjuxYZ5GwnAkwhjgB60cJx4XaYp_JHIeELleB5N5Uhp_UjLFF8zcbEZYQCZ_CnyrPc89thVdB5OFJcrnYiI6-vp8XEQ41tAqkMK6O1jIUspa_dJOu3sgVybHRtiwaCuId3u1lhOHFCWgyJkwGZz_cwhqSj7VF487aAbrr7YAnOT15chO2d5Poo5N9_oKSu42Dd-COnz0yCyfW3dt6UAquwAT7TkUF4v-IkmlBy7xpVuJ3UJJHUMy-wypyAg0C0";
      expect(signedHeaders).to.have.keys([
        "x-public-key",
        "x-nonce",
        "x-signature",
      ]);
      expect(signedHeaders["x-signature"])
        .to.equal(toB64Url(Buffer.from(signedData)))
        .to.equal(expectedSignature);
      expect(signedHeaders["x-public-key"]).to.equal(testArweaveWallet.n);
      expect(signedHeaders["x-nonce"]).to.equal(nonce);
    });
  });

  it("snapshot test for signing data with eth wallet", async () => {
    const data = "123";
    const signature = await signEthereumData(testEthereumWallet, data);
    expect(fromB64Url(signature).toString("hex")).to.equal(
      "1c7fab2b2390c823fb7e7876df0237e34a8cdc413d1f2ecbf4a88b90ea333f055a56b640b3ee07f31c051f8f98b810af4b7acf85341beff097bd2122d52e3d491c"
    );
  });
});
