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
  AOProcess,
  ARIO,
  ARIOToken,
  AoARIOWrite,
  AoArNSNameData,
  AoClient,
  AoMessageResult,
  AoSigner,
  ArweaveSigner,
  BadRequest,
  TransactionId,
  createAoSigner,
  mARIOToken,
} from "@ar.io/sdk";
import { ReadThroughPromiseCache } from "@ardrive/ardrive-promise-cache";
import { connect } from "@permaweb/aoconnect";
import { MessageResult } from "@permaweb/aoconnect/dist/lib/result";
import { Tag } from "arweave/node/lib/transaction";
import winston from "winston";

import { Gateway, GatewayParams, TransactionInfo, TransactionStatus } from ".";
import { msPerMinute } from "../constants";
import {
  ArNSNameType,
  ArNSPurchase,
  ArNSTokenCostParams,
} from "../database/dbTypes";
import globalLogger from "../logger";
import { JWKInterface } from "../types/jwkTypes";
import { ownerToAddress } from "../utils/base64";
import { sendArNSBuySlackMessage } from "../utils/slack";

export interface ARIOInterface {
  getTokenCost(p: ArNSTokenCostParams): Promise<mARIOToken>;
  initiateArNSPurchase(p: ArNSPurchase): Promise<AoMessageResult>;
}

export type ARIOConstructorParams = GatewayParams & {
  jwk?: JWKInterface;
  processId?: string;
  logger?: winston.Logger;
  cuUrl?: string; // Custom URL for the AO Compute Unit
  arioLeaseNameDustAmount?: number;
  arioPermaBuyNameDustAmount?: number;
};

export class ARIOGateway extends Gateway implements ARIOInterface {
  private arioWritable?: AoARIOWrite;
  private aoSigner?: AoSigner;
  private arioAddress?: string;
  private ao: AoClient;
  private processId: string;

  private logger: winston.Logger;
  public endpoint: URL;

  private arioLeaseNameDustAmount: number;
  private arioPermaBuyNameDustAmount: number;

  constructor({
    endpoint = new URL("https://arweave.net"),
    jwk,
    logger = globalLogger,
    processId = process.env.ARIO_PROCESS_ID ??
      "qNvAoz0TgcH7DMg8BCVn8jF32QH5L6T29VjHxhHqqGE",
    cuUrl = process.env.CU_URL,

    arioLeaseNameDustAmount = +(process.env.ARIO_LEASE_NAME_DUST_AMOUNT ?? 1),
    arioPermaBuyNameDustAmount = +(
      process.env.ARIO_PERMA_BUY_NAME_DUST_AMOUNT ?? 5
    ),

    ...gatewayParams
  }: ARIOConstructorParams = {}) {
    super(gatewayParams);

    this.arioLeaseNameDustAmount = arioLeaseNameDustAmount;
    this.arioPermaBuyNameDustAmount = arioPermaBuyNameDustAmount;
    this.logger = logger;
    this.endpoint = endpoint;
    this.processId = processId;

    this.ao = connect({
      CU_URL: cuUrl,
    });

    if (jwk !== undefined) {
      this.aoSigner = createAoSigner(new ArweaveSigner(jwk));
      this.arioWritable = ARIO.init({
        signer: this.aoSigner,
        process: new AOProcess({
          processId,
          ao: this.ao,
        }),
      });
      this.arioAddress = ownerToAddress(jwk.n);
    } else {
      logger.warn(
        "ARIO_SIGNING_JWK is not set, ArNS writes will not be available"
      );
    }
  }

  private mARIOBalancePromiseCache = new ReadThroughPromiseCache<
    string,
    number
  >({
    cacheParams: {
      cacheCapacity: 100,
      cacheTTL: msPerMinute * 60, // 60 minutes
    },
    readThroughFunction: async (address: string) => {
      if (this.arioWritable === undefined) {
        throw new Error("No signer available for ARIO Gateway");
      }
      return this.arioWritable.getBalance({ address });
    },
  });

  private tokenCostPromiseCache = new ReadThroughPromiseCache<string, number>({
    cacheParams: {
      cacheCapacity: 100,
      cacheTTL: msPerMinute * 5,
    },
    readThroughFunction: async (cacheKey: string) => {
      const [name, intent, type, years, increaseQty] = cacheKey.split(";");
      if (this.arioWritable === undefined) {
        throw new Error("No signer available for ARIO Gateway");
      }
      const tokenCost = await this.arioWritable.getTokenCost({
        name,
        intent: intent as ArNSPurchase["intent"],
        type: type as ArNSNameType,
        years: Number(years),
        quantity: Number(increaseQty),
      });
      return tokenCost;
    },
  });

  private arnsRecordPromiseCache = new ReadThroughPromiseCache<
    string,
    AoArNSNameData | undefined
  >({
    cacheParams: {
      cacheCapacity: 100,
      cacheTTL: msPerMinute * 5,
    },
    readThroughFunction: async (name: string) => {
      if (this.arioWritable === undefined) {
        throw new Error("No signer available for ARIO Gateway");
      }
      const record = await this.arioWritable.getArNSRecord({ name });
      if (!record) {
        return undefined;
      }
      return record;
    },
  });

  async getTokenCost({
    name,
    type,
    years,
    intent,
    increaseQty,
    assertBalance = false,
  }: ArNSTokenCostParams): Promise<mARIOToken> {
    const existingName = await this.arnsRecordPromiseCache.get(name);

    if (intent === "Buy-Name" || intent === "Buy-Record") {
      if (existingName !== undefined) {
        throw new BadRequest(`Name ${name} already exists`);
      }
    } else if (
      intent === "Upgrade-Name" ||
      intent === "Increase-Undername-Limit" ||
      intent === "Extend-Lease"
    ) {
      if (existingName === undefined) {
        throw new BadRequest(`Name ${name} does not exist`);
      }

      if (
        (intent === "Upgrade-Name" || intent === "Extend-Lease") &&
        existingName.type === "permabuy"
      ) {
        throw new BadRequest(`Name ${name} is a permabuy`);
      }
    }

    const cacheKey = `${name};${intent};${type};${years};${increaseQty}`;
    const cost = await this.tokenCostPromiseCache.get(cacheKey);

    const tokenCost = new mARIOToken(cost);
    if (assertBalance && this.arioAddress !== undefined) {
      const existingBalance = await this.mARIOBalancePromiseCache.get(
        this.arioAddress
      );

      if (existingBalance < tokenCost.valueOf()) {
        throw new Error(
          `Turbo wallet (${
            this.arioAddress
          }) has insufficient mARIO balance. Required: ${tokenCost.valueOf()}, Available: ${existingBalance}`
        );
      }
    }
    return tokenCost;
  }

  async initiateArNSPurchase(
    params: Omit<ArNSPurchase, "messageId" | "paidBy"> & {
      promoCodes?: string[];
      paidBy?: string[];
    }
  ): Promise<AoMessageResult> {
    if (this.arioWritable === undefined) {
      throw new Error("No signer available for ARIO Gateway");
    }
    const { name, type, processId, years, intent, increaseQty, owner } = params;

    try {
      let messageResult: AoMessageResult;
      switch (intent) {
        case "Buy-Name":
        case "Buy-Record":
          if (processId === undefined) {
            throw new BadRequest("Process ID is required for Buy ArNS Name");
          }
          messageResult = await this.arioWritable.buyRecord({
            name,
            type: type as ArNSNameType, // validated in route
            processId,
            years,
          });
          void sendArNSBuySlackMessage({
            ...params,
            messageId: messageResult.id,
            promoCodes: params.promoCodes ?? [],
            paidBy: params.paidBy ?? [],
          });
          void this.dustPurchaserWithARIO(owner, type as ArNSNameType);

          break;
        case "Upgrade-Name":
          messageResult = await this.arioWritable.upgradeRecord({
            name,
          });
          break;
        case "Extend-Lease":
          if (years === undefined) {
            throw new BadRequest("Years is required for Extend-Lease");
          }
          messageResult = await this.arioWritable.extendLease({
            name,
            years,
          });
          break;
        case "Increase-Undername-Limit":
          if (increaseQty === undefined) {
            throw new BadRequest("increaseQty is required for Extend-Lease");
          }
          messageResult = await this.arioWritable.increaseUndernameLimit({
            name,
            increaseCount: increaseQty,
          });
          break;
        default:
          throw new BadRequest(`Invalid intent: ${intent}`);
      }
      this.mARIOBalancePromiseCache.clear();
      this.arnsRecordPromiseCache.remove(name);
      return messageResult;
    } catch (error) {
      this.logger.error("Error during ArNS Purchase", error, {
        name,
        type,
        processId,
        years,
        intent,
        increaseQty,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async dustPurchaserWithARIO(
    owner: string,
    type: ArNSNameType
  ): Promise<void> {
    if (this.arioWritable === undefined) {
      throw new Error("No signer available for ARIO Gateway");
    }
    const dustAmount =
      type === "permabuy"
        ? this.arioPermaBuyNameDustAmount
        : this.arioLeaseNameDustAmount;
    try {
      const result = await this.arioWritable.transfer({
        target: owner,
        qty: new ARIOToken(dustAmount).toMARIO(),
      });
      this.logger.info(
        `Dusted ${dustAmount} mARIO to ${owner} for buy record`,
        { result }
      );
    } catch (error) {
      this.logger.error(
        `Error dusting purchaser with ARIO for buy record`,
        error
      );
      // If dusting fails, we will contain the error in this scope -- don't rethrow
    }
  }

  private readAoResult(transactionId: string): Promise<MessageResult> {
    return this.ao.result({
      message: transactionId,
      process: this.processId,
    });
  }

  private aoResultFoundCache = new ReadThroughPromiseCache<
    TransactionId,
    MessageResult
  >({
    cacheParams: {
      cacheCapacity: 10_000,
      cacheTTL: msPerMinute * 60, // cache successful read through result for 60 minutes
    },
    readThroughFunction: async (transactionId: string) => {
      const result = await this.readAoResult(transactionId);
      if (result === undefined || "error" in result) {
        this.logger.error(
          "Read an AO message that is not found or has errored",
          {
            transactionId,
            result,
          }
        );
        throw new Error("AO message result not found or found an Error!");
      }
      return result;
    },
  });

  private aoResultReadThroughPromiseCache = new ReadThroughPromiseCache<
    TransactionId,
    MessageResult | undefined
  >({
    cacheParams: {
      cacheCapacity: 10_000,
      cacheTTL: 5000, // cache not found results for 5 seconds
    },
    readThroughFunction: async (transactionId: string) => {
      const cachedResult = await this.aoResultFoundCache
        .get(transactionId)
        .catch(() => undefined);
      return cachedResult;
    },
  });

  public async getTransaction(
    transactionId: TransactionId
  ): Promise<TransactionInfo> {
    let result: MessageResult | undefined;
    try {
      result = await this.aoResultReadThroughPromiseCache.get(transactionId);
      if (
        result === undefined ||
        ("error" in result &&
          typeof result.error === "string" &&
          result.error.includes("Message or Process not found"))
      ) {
        throw new Error("AO message result not found!");
      }

      if (result.Messages === undefined) {
        throw new Error(
          "AO message result has no Messages!" + JSON.stringify(result, null, 2)
        );
      }

      const creditNoticeMessage = result.Messages.find((message) =>
        message.Tags.some((tag: Tag) => tag.value === "Credit-Notice")
      );
      if (creditNoticeMessage === undefined) {
        throw new Error("AO Result has no valid Credit-Notice message!");
      }

      const transactionSenderAddress = creditNoticeMessage.Tags.find(
        (tag: Tag) => tag.name === "Sender"
      )?.value;
      const transactionQuantity = creditNoticeMessage.Tags.find(
        (tag: Tag) => tag.name === "Quantity"
      )?.value;
      const transactionRecipientAddress = creditNoticeMessage.Target;

      if (
        transactionSenderAddress === undefined ||
        transactionQuantity === undefined ||
        transactionRecipientAddress === undefined
      ) {
        throw new Error("AO Result is missing required tags!");
      }

      return {
        transactionQuantity,
        transactionRecipientAddress,
        transactionSenderAddress,
      };
    } catch (error) {
      this.logger.error("Error reading AO message", {
        error,
        transactionId,
        message: error instanceof Error ? error.message : String(error),
        aoMessageResult: result,
      });
      throw error;
    }
  }

  public async getTransactionStatus(
    transactionId: TransactionId
  ): Promise<TransactionStatus> {
    const message = await this.getTransaction(transactionId);

    if (message === undefined) {
      return {
        status: "not found",
      };
    }

    return {
      // If the AO message is cranked, it means it's confirmed
      status: "confirmed",
      // Placeholder block height, as ARIO process does not require block height
      // and it may not yet have an Arweave block height by the time of cranking
      blockHeight: 0,
    };
  }
}
