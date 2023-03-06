// import { expect } from "chai";
// import { generateKeyPair } from "node:crypto";

// import { signRequest, verifySignedRequest } from "./signedRequestHelper";

// describe("Signed Requests", () => {
//   it("Generates and verifies signed request", async () => {
//     const { publicKey, privateKey } = await new Promise<{
//       publicKey: string;
//       privateKey: string;
//     }>((resolve, reject) => {
//       generateKeyPair(
//         "rsa",
//         {
//           modulusLength: 4096,
//           publicKeyEncoding: {
//             type: "spki",
//             format: "pem",
//           },
//           privateKeyEncoding: {
//             type: "pkcs8",
//             format: "pem",
//             cipher: "aes-256-cbc",
//             passphrase: "top secret",
//           },
//         },
//         (err, publicKey, privateKey) => {
//           if (err) return reject(err);
//           resolve({ publicKey, privateKey });
//         }
//       );
//     });

//     // Handle errors and use the generated key pair.
//     const data = Uint8Array.from([1, 2, 3, 4]);
//     const nonce = "nonce";
//     const signature = await signRequest(privateKey, data, nonce);
//     const verified = await verifySignedRequest(
//       publicKey,
//       data,
//       nonce,
//       signature
//     );
//     expect(verified).to.be.true;
//   },

//   );
// });
