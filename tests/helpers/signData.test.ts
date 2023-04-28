import { expect } from "chai";

import { jwkInterfaceToPrivateKey } from "../../src/types/jwkTypes";
import { toB64Url } from "../../src/utils/base64";
import { signData } from "../../tests/helpers/signData";
import { testWallet } from "../../tests/helpers/testHelpers";

describe("signData", () => {
  it("snapshot test for signing with crypto.constants.RSA_PKCS1_PSS_PADDING", async () => {
    const privateKey = jwkInterfaceToPrivateKey(testWallet);
    const signature = await signData(privateKey, "123");

    const expectedSignature =
      "E0LcK9s6-RlidqtMz0bIYaIYzhGfKFrKNHC3wPeuKFju5XPU4vFJBM-mv-Fh-9T99joSOl37taWWzfVUemuHTgPVZputEEM5tNj1Neao_C1ssoAvJeVfAuEaZGPWPjanpVOCv1JpA8BD0C1IkGHaCNr8ajMt-CmfwKllaZ5xFEP3C6dp2REmr5P0wcefLYWwPcdFMvScz_dotWYurDctWtrxxm2E6gkbLkQSgyGa5mBkzP31evV6j0bXOzmtnE_jS4tuwVs6E8i0vzrRlHk1gq0YUtAhKs2s4FBbnsVxLBuSQGEL9s4geQo_NOCEPKVPlsUYcg8Q0acmNTXJWsZJRqQsNR0qnN5HM9yZO2LW-899UayVY4nUDU2urLDoXr9FiLKtPKdtPX0YGMx9xgpDSXMZ-vyuicTZLZbd8zGft82tFHU-yqK5xn2K96FY6RRhWamRmanwgRV8ISvVsEQ57TppGWgWNGIzX0ZmtU8rc11bncG2adACzqmfa9FBV4h2oWAHjpkvYprK2cTapEoC6SMhNeDTPRHb2zCDkHI5j__yr0w24HZYGGxp70Tfnk4XhbeINREVCydofoc1PD9B3frLqKYbwik0JNVsdEI56z4F_YuSCfmmOvXqfDB32BHjmt28KM-Rdb_9mblOejfSjPz-xpFRPmT0WLClR9JLiE4";
    expect(toB64Url(Buffer.from(signature))).to.equal(expectedSignature);
  });
});
