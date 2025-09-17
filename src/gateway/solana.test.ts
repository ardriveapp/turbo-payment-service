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
import {
  Keypair,
  PublicKey,
  VersionedTransactionResponse,
} from "@solana/web3.js";
import { expect } from "chai";

import { SolanaGateway } from "./solana";

const key1 = Keypair.generate().publicKey;
const key2 = Keypair.generate().publicKey;

describe("SolanaGateway", () => {
  const gateway = new SolanaGateway();

  describe("getAllTxInstructions", () => {
    it("should decompile transaction instructions correctly", () => {
      const mockTx: VersionedTransactionResponse = {
        transaction: {
          message: {
            staticAccountKeys: [
              new PublicKey("11111111111111111111111111111111"),
              key1,
              key2,
            ],
            isAccountSigner: (index: number) => index === 1,
            isAccountWritable: (index: number) => index === 2,
            compiledInstructions: [
              {
                programIdIndex: 0,
                accountKeyIndexes: [1, 2],
                data: Uint8Array.from([
                  3, 78, 45, 51, 78, 45, 51, 78, 45, 51, 78, 45, 51, 78, 45, 51,
                ]),
              },
            ],
          },
        },
      } as VersionedTransactionResponse;
      const instructions = gateway["getAllTxInstructions"](mockTx);
      expect(instructions).to.have.length(1);
      expect(instructions[0].programId.toBase58()).to.equal(
        "11111111111111111111111111111111"
      );
      expect(instructions[0].keys).to.have.length(2);
      expect(instructions[0].keys[0].pubkey.toBase58()).to.equal(
        key1.toBase58()
      );
      expect(instructions[0].keys[0].isSigner).to.be.true;
      expect(instructions[0].keys[1].pubkey.toBase58()).to.equal(
        key2.toBase58()
      );
      expect(instructions[0].keys[1].isSigner).to.be.false;

      expect(instructions[0].keys[1].isWritable).to.be.true;
      expect(instructions[0].data.toString("hex")).to.equal(
        "034e2d334e2d334e2d334e2d334e2d33"
      );
    });

    /** ── encode a SystemProgram.transfer(1 000 lamports) ───────────────
     * layout = u32(le) instruction-index (2)  +  u64(le) lamports
     */
    const lamports = 1_000n;
    const transferRaw = Buffer.alloc(12);
    transferRaw.writeUInt32LE(2, 0); // “Transfer” discriminator
    transferRaw.writeBigUInt64LE(lamports, 4); // 1 000 lamports
    it("should handle a valid transaction with transfer instruction", async () => {
      const mockTx: VersionedTransactionResponse = {
        transaction: {
          message: {
            staticAccountKeys: [
              // 0 → SystemProgram.programId
              new PublicKey("11111111111111111111111111111111"),
              // 1 → sender (signer)
              key1,
              // 2 → recipient (writable)
              key2,
            ],
            isAccountSigner: (i: number) => i === 1,
            isAccountWritable: (i: number) => i === 2,
            compiledInstructions: [
              {
                programIdIndex: 0, // SystemProgram
                accountKeyIndexes: [1, 2], // from, to
                data: transferRaw, // <- encoded transfer
              },
            ],
          },
        },
      } as unknown as VersionedTransactionResponse;
      const [instructions] = gateway["getAllTxInstructions"](mockTx);

      // structural assertions
      expect(instructions.programId.toBase58()).to.equal(
        "11111111111111111111111111111111"
      );
      expect(instructions.keys).to.have.length(2);
      expect(instructions.keys[0].pubkey.toBase58()).to.equal(key1.toBase58());
      expect(instructions.keys[0].isSigner).to.be.true;
      expect(instructions.keys[1].pubkey.toBase58()).to.equal(key2.toBase58());
      expect(instructions.keys[1].isWritable).to.be.true;

      // data payload should match the encoded transfer bytes
      expect(instructions.data.toString("hex")).to.equal(
        "02000000e803000000000000" // 0x02 + 0x000003e8
      );
    });
  });
});
