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
import { BadRequest } from "@ar.io/sdk";
import {
  CompiledInstruction,
  MessageCompiledInstruction,
  PublicKey,
  Connection as SolanaConnection,
  SystemInstruction,
  SystemProgram,
  TransactionInstruction,
  VersionedMessage,
  VersionedTransactionResponse,
} from "@solana/web3.js";
import BigNumber from "bignumber.js";
import bs58 from "bs58";

import { gatewayUrls } from "../constants";
import { PaymentTransactionNotFound } from "../database/errors";
import logger from "../logger";
import { walletAddresses } from "../routes/info";
import { TransactionId } from "../types";
import {
  Gateway,
  GatewayParams,
  TransactionInfo,
  TransactionStatus,
} from "./gateway";

export class SolanaGateway extends Gateway {
  public endpoint: URL;

  private connection: SolanaConnection;

  constructor({
    endpoint = gatewayUrls.solana,
    paymentTxPollingWaitTimeMs,
    pendingTxMaxAttempts,
  }: GatewayParams = {}) {
    super({
      paymentTxPollingWaitTimeMs,
      pendingTxMaxAttempts,
    });
    this.endpoint = endpoint;
    this.connection = new SolanaConnection(endpoint.toString());
  }

  public async getTransactionStatus(
    transactionId: TransactionId
  ): Promise<TransactionStatus> {
    logger.debug("Getting transaction status...", { transactionId });
    const txResponse = await this.connection.getTransaction(transactionId, {
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    });

    if (txResponse?.meta) {
      return {
        // SOL Tx found in finalized state means its confirmed in the given block
        status: "confirmed",
        blockHeight: txResponse.slot,
      };
    }

    // fallback to confirmed if we can't find the transaction as finalized
    const confirmedResponse = await this.connection.getTransaction(
      transactionId,
      {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      }
    );

    if (confirmedResponse?.meta) {
      return {
        // SOL Tx found in confirmed state means its pending in the given block, could still be forked
        status: "pending",
      };
    }

    return {
      // SOL Tx not found in confirmed state means its not found
      status: "not found",
    };
  }

  /* Helper: convert a CompiledInstruction into a TransactionInstruction */
  private decompileTransactionInstructions(
    ix: CompiledInstruction | MessageCompiledInstruction,
    msg: VersionedMessage
  ): TransactionInstruction {
    const indices = "accounts" in ix ? ix.accounts : ix.accountKeyIndexes;
    const programId = msg.staticAccountKeys[ix.programIdIndex];
    const keys = indices.map((i) => ({
      pubkey: msg.staticAccountKeys[i],
      isSigner: msg.isAccountSigner(i),
      isWritable: msg.isAccountWritable(i),
    }));

    let raw;
    try {
      raw = typeof ix.data === "string" ? bs58.decode(ix.data) : ix.data;
    } catch (error) {
      throw new Error(
        `Failed to decode instruction data from base58: ` +
          (error instanceof Error ? error.message : String(error)) +
          `\nData: ${
            typeof ix.data === "string" ? ix.data : JSON.stringify(ix.data)
          }`
      );
    }

    return new TransactionInstruction({
      programId,
      keys,
      data: raw instanceof Buffer ? raw : Buffer.from(raw),
    });
  }

  private getAllTxInstructions(
    tx: VersionedTransactionResponse
  ): TransactionInstruction[] {
    const msg = tx.transaction.message;
    // Legacy txs have msg.instructions; v0/v1 have msg.compiledInstructions
    const outerCompiled =
      "compiledInstructions" in msg
        ? msg.compiledInstructions
        : // @ts-expect-error  – legacy message has `instructions`
          (msg.instructions as CompiledInstruction[]);
    const innerCompiled =
      tx.meta?.innerInstructions?.flatMap((ii) => ii.instructions) ?? [];

    return [...outerCompiled, ...innerCompiled].map((ci) =>
      this.decompileTransactionInstructions(ci, msg)
    );
  }

  private solanaRecipientAddress = new PublicKey(walletAddresses["solana"]);

  public async getTransaction(
    transactionId: TransactionId
  ): Promise<TransactionInfo> {
    return this.pollGatewayForTx(async () => {
      const tx = await this.connection.getTransaction(transactionId, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (!tx || !tx.meta) throw new PaymentTransactionNotFound(transactionId);

      const allTxIxs = this.getAllTxInstructions(tx);

      /* Locate exactly one SystemProgram.transfer ➜ merchant */
      const transfersToMerchant = allTxIxs.flatMap((ix) => {
        if (!ix.programId.equals(SystemProgram.programId)) return [];
        try {
          if (SystemInstruction.decodeInstructionType(ix) !== "Transfer")
            return [];

          const { fromPubkey, toPubkey, lamports } =
            SystemInstruction.decodeTransfer(ix);
          return toPubkey.equals(this.solanaRecipientAddress)
            ? [{ fromPubkey, lamports }]
            : [];
        } catch {
          return [];
        }
      });

      if (transfersToMerchant.length !== 1) {
        throw new BadRequest(
          `Transaction must contain exactly one SOL transfer to ${this.solanaRecipientAddress.toBase58()} (found ${
            transfersToMerchant.length
          }).`
        );
      }

      const { fromPubkey, lamports } = transfersToMerchant[0];
      const instructionQty = BigNumber(lamports.toString());

      /* Verify our balance actually increased by that amount */
      const recvIdx = tx.transaction.message
        .getAccountKeys()
        .staticAccountKeys.findIndex((k) =>
          k.equals(this.solanaRecipientAddress)
        );
      const delta = BigNumber(tx.meta.postBalances[recvIdx]).minus(
        tx.meta.preBalances[recvIdx]
      );

      if (!delta.eq(instructionQty) || delta.lte(0)) {
        throw new BadRequest(
          `Mismatch: instruction paid ${instructionQty.toString()} lamports, ` +
            `but balance delta was ${delta.toString()}.`
        );
      }

      return {
        transactionQuantity: delta,
        transactionSenderAddress: fromPubkey.toBase58(),
        transactionRecipientAddress: this.solanaRecipientAddress.toBase58(),
      };
    }, transactionId);
  }
}
