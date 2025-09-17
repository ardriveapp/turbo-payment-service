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
import { AxiosInstance } from "axios";
import BigNumber from "bignumber.js";

import { createAxiosInstance } from "../axiosClient";
import { gatewayUrls } from "../constants";
import {
  PaymentTransactionNotMined,
  TransactionNotAPaymentTransaction,
} from "../database/errors";
import globalLogger from "../logger";
import {
  Gateway,
  GatewayParams,
  TransactionInfo,
  TransactionStatus,
} from "./gateway";

type KyveTransferTx = {
  "@type": "/cosmos.bank.v1beta1.MsgSend";
  from_address: string;
  to_address: string;
  amount: { denom: "ukyve"; amount: string }[];
};

type KyveTx = Record<string, unknown>;

type KyveResponseWithTxResponse = {
  tx_response: {
    code: number;
    height: string;
    tx: {
      "@type": "/cosmos.tx.v1beta1.Tx";
      body: {
        messages: [KyveTx | KyveTransferTx];
      };
    };
  };
};
type KyveBlockResponse = {
  block: {
    height: string;
  };
};
type KyveErrorResponse = {
  code: number;
  message: string;
};
type KyveApiResponse =
  | KyveResponseWithTxResponse
  | KyveErrorResponse
  | KyveBlockResponse;

function hasKyveTxResponse(
  response: KyveApiResponse
): response is KyveResponseWithTxResponse {
  return (response as KyveResponseWithTxResponse).tx_response !== undefined;
}

function isKyveTransferTx(tx: KyveTx | KyveTransferTx): tx is KyveTransferTx {
  return (tx as KyveTransferTx).from_address !== undefined;
}

type KyveGatewayParams = GatewayParams & {
  axiosInstance?: AxiosInstance;
};

export class KyveGateway extends Gateway {
  public endpoint: URL;
  private axiosInstance: AxiosInstance;

  constructor({
    endpoint = gatewayUrls.kyve,
    paymentTxPollingWaitTimeMs,
    pendingTxMaxAttempts = 3,
    axiosInstance = createAxiosInstance({
      retries: 3,
      // Retry only on 5xx errors
      config: { validateStatus: (status) => status >= 200 && status < 500 },
    }),
  }: KyveGatewayParams = {}) {
    super({
      paymentTxPollingWaitTimeMs,
      pendingTxMaxAttempts,
    });
    this.endpoint = endpoint;
    this.axiosInstance = axiosInstance;
  }

  private get txEndpoint() {
    return this.endpoint + "/cosmos/tx/v1beta1/txs/";
  }

  public getTransaction(transactionId: string): Promise<TransactionInfo> {
    return this.pollGatewayForTx(async () => {
      globalLogger.debug("Getting transaction...", { transactionId });
      const response = await this.axiosInstance.get<KyveApiResponse>(
        this.txEndpoint + transactionId
      );

      if (!response || !response.data || !hasKyveTxResponse(response.data)) {
        return undefined;
      }
      const txResponse = response.data.tx_response;

      if (response.data.tx_response.code !== 0) {
        throw new PaymentTransactionNotMined(transactionId);
      }

      const txBody = txResponse.tx.body.messages[0];
      globalLogger.debug("Got transaction", { txBody });
      if (!isKyveTransferTx(txBody)) {
        throw new TransactionNotAPaymentTransaction(transactionId);
      }

      const validDenominations = ["ukyve", "tkyve"];
      if (
        !txBody.amount[0].denom ||
        !validDenominations.includes(txBody.amount[0].denom)
      ) {
        throw new TransactionNotAPaymentTransaction(transactionId);
      }

      return {
        transactionQuantity: BigNumber(txBody.amount[0].amount),
        transactionSenderAddress: txBody.from_address,
        transactionRecipientAddress: txBody.to_address,
      };
    }, transactionId);
  }

  public async getTransactionStatus(
    transactionId: string
  ): Promise<TransactionStatus> {
    const response = await this.axiosInstance.get<KyveApiResponse>(
      this.txEndpoint + transactionId
    );

    if (
      !response ||
      !response.data ||
      !hasKyveTxResponse(response.data) ||
      response.data.tx_response.code !== 0
    ) {
      return { status: "not found" };
    }

    return {
      status: "confirmed",
      blockHeight: +response.data.tx_response.height,
    };
  }
}
