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
import axiosPackage from "axios";
import { expect } from "chai";
import { HDNodeWallet } from "ethers";
import { Knex } from "knex";
import Stripe from "stripe";

import { createAxiosInstance } from "../../src/axiosClient";
import { PostgresDatabase } from "../../src/database/postgres";
import { MandrillEmailProvider } from "../../src/emailProvider";
import {
  ArweaveGateway,
  EthereumGateway,
  GatewayMap,
  KyveGateway,
  MaticGateway,
  SolanaGateway,
} from "../../src/gateway";
import { ARIOGateway } from "../../src/gateway/ario";
import { BaseEthGateway } from "../../src/gateway/base-eth";
import {
  ArweaveBytesToWinstonOracle,
  ReadThroughBytesToWinstonOracle,
} from "../../src/pricing/oracles/bytesToWinstonOracle";
import {
  CoingeckoTokenToFiatOracle,
  ReadThroughTokenToFiatOracle,
} from "../../src/pricing/oracles/tokenToFiatOracle";
import { TurboPricingService } from "../../src/pricing/pricing";
import { JWKInterface } from "../../src/types/jwkTypes";
import { DbTestHelper } from "../dbTestHelper";

const port = process.env.PORT ?? 1234;
export const localTestUrl = `http://localhost:${port}`;

interface expectAsyncErrorThrowParams {
  promiseToError: Promise<unknown>;

  // errorType: 'Error' | 'TypeError' | ...
  errorType?: string;
  errorMessage?: string;
}

/**
 * Test helper function that takes a promise and will expect a caught error
 *
 * @param promiseToError the promise on which to expect a thrown error
 * @param errorType type of error to expect, defaults to 'Error'
 * @param errorMessage exact error message to expect
 * */
export async function expectAsyncErrorThrow({
  promiseToError,
  errorType = "Error",
  errorMessage,
}: expectAsyncErrorThrowParams): Promise<void> {
  let error: null | Error = null;
  try {
    await promiseToError;
  } catch (err) {
    error = err as Error | null;
  }

  expect(error?.name).to.equal(errorType);

  if (errorMessage) {
    expect(error?.message).to.equal(errorMessage);
  }
}

type KnexRawResult = {
  command: string; // "SELECT" |
  rowCount: number; // 1
  oid: unknown; // null
  rows: { table_name: string }[]; //  [ { table_name: 'new_data_item_1' } ]
  fields: {
    name: string; // "table_name"
    tableID: number; // 13276
    columnID: number; // 3
    dataTypeID: number; // 19
    dataTypeSize: number; // 64
    dataTypeModifier: number; // -1
    format: "text";
  }[];
};

export function listTables(pg: Knex): Knex.Raw<KnexRawResult> {
  return pg.raw(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name"
  );
}

export const testArweaveWallet: JWKInterface = {
  kty: "RSA", // cspell:disable
  n: "i0V3ejfc2ZFFRptzx5Tx8ShWtO9LTvunuqMbgqymvMNPjtFWi6pyg6xTIl0qL4xb5Dtv-5O8GO4lfNn5mPDnCfNGIrcY0TO82HH8CVT5g2KsZzBec_XjjxwKeRmoYzMB2JxCBzMm5kVhURN98Vz8_aETlU0JDbWdOsDcVsTWk_fPmyu-Bo3KQVB9X8o9EgySVl9CD9FiAAMQsRjOhe2ACzqqiaEOraTZPtA53R3LdeHRC3S0no1Ux-_4T5hisPlSRXrJ5OFpzQKizMEQ8_Hnw3QAB1KRgdBKYd34SlQWHF3bDuk_5m1nWYusIJ92GNxPuO1ic6AZKpWgZEC3b4-qwvJmhQfBB79yNvxMLyvav1k2rCUzEy2-tA5DSyKTwOuZiNNx9anpabQxiA7jeXglk4q8DGJ8kLMoicG3XiSswB_a7u2cNSkbSqOzV65_th71jVfRpLpXRqFuq-H0qmAgA8iweSzd-YsOpVxsGgOOQXJORYfDRwPpk44RuQbGYzqcVjfEc8R2-NkndJb3lgA1lcUkGgrBTcb-j1Xv-wQ0wjnJ3zBbvM4lNgEc4Oj6aZD715spC7b_FB7DYQNuUzXpDlDqqH8uvT-Vt-z_UDn9qse5dXJBk4p5N4QYkHDt9JYyNplUlufQlHzJTuj_fZwBD_-hRdcmrZaifjHU4hagCU8",
  e: "AQAB",
  d: "B6zkmipTLcGXm5ePnu0yrd0ddWVGtWvUrf2CBtNn12yJvIMFWp2IwbPEKFdE4hzBjhquEwnssN1wpXVuqW-4jxzTV0oKwEsyQIxJNpgMFDvI6Prw1nUzsFX8SCysBT0kM4FERkwayOmdiy-6BIytlXcq5blUIwEVhDQCykL_P5jFqtvGe9GVCidBPmYEtAAk96ufFjeuesLjrzVNx6XAi8RIIV05IN3xg-IX5K6_essSKUGqS2tzw7BFWaWgf5GOAWEN_vyWE-ohEyW38hAsrkhJt1DLaIF6x_MviHEjGTcdW0oEvB9FaQyNVOyIDQ1_O0YISftsLgoG-xKlL8aVw4nXmCj414lApZ3DRXzPcz3_8vv_6aweeoCiWd5t75gaD6ZeelPEFbB-3RoQA57WYJE6hJoy-CYlm4p9VSJ958QuO-wN9QDRIQsWf52fQAAZhoiroA9CQiPc2kXNL6p_HAHBxwWljXPRLg9VXN8ILnimx2qjLyfdPVHMqfFpR2nZot64XQ11Didx_4uZyjDRwxtzwJkn0KXEdZBKT4aznFZ9im76u3vQy5Xn1wcnrFFFpNeePoOv7fBWf5cgvbg_o7HvbSjkz-cSwJ1KftXAHOsUrnzzbLLWnBN4qmaG5lDFrOuLE7mArvJ2QVR8ZgXLFDGsHVeI1MzlftVNgIEmmEE",
  p: "t7pYl8md8kqA82jZ23T6c5_wJbZD4jNUW8-NdSQO36wPgFkfwUBrEKxWLg4T7eApYYmpolvVSFIPqePV_xI2iqz4ypkAlnFitF5TqylLtxHB7KOS4JhoMfXCrzFFi8U8dAZiYU3lkPR0kkVt_F44ldl9meTN9PIBj9UIdBh6hnM7elkrUARZl49K05isJWFL0DNHK30bNtxuHd_qQOtf0Uqf1R3djUn3eNMlTtCXWS6X0cMm94USlHdLETvquW_mB3aIo56HHr1tf5rCHzRTGImS22flhnKNXtc_cZeJ2Hp8JesbpHQoPqsjYyXiBxOP8YiYndgDpe1_8vrw2vdAbw",
  q: "wg5IqecTPM35QWaKXjzMJroeQPj_mpPn9ezHyUNS3i21LClNDY8Mky3QztJ4dgrh9bf2MswtaRjl9rTeMSdwuf5zg9sONxQ0qsSg1LV2Zu5eCe_p-31c3-aX5YBPNKNZ50HMqx3FmfIjfBkFOOmWhGSPIDFjKuwISXuw3YaZDiFtRjZ3UYZ0A1Z8zgkYFM-6wJXeVSpMVfZuSDCDOzCPUvHAHtdZOanpnMjLerqCCzUim817B69OFaRrglOh-9wJiqAIwcBS_45qJksoSoUcFwKjZ9XkLUUSh7IbmQ1opvO6Tsg2mOH_WS3gmA6IRmMIRfvT9nTQvpMh2uq2M5J1IQ",
  dp: "jYC0-Pqsbk6ZcF8h41b-Cg11nOX69H2KDEgXb8_8sKJJMhXyUhm2HBpPKZtoF_5cgKXRA53s741cSQGT8KbrYPUFjKw4eqYLWlWH5Tyh9vZzQDlfRyG6pjfc4Kd3I8Yd4FKGdODU3UaZfYqBwiwjMq5WgS9qvKujLk7p-thbja-0cG-63x7qjcMr4zoj44pDJLBJsSHi0ucE3Hd3aNafbocmALLGzynXsrQUeNZIqsQq48CFA3_3JmeWZkiaaIXZSYguhq3y7WcBrZTYy8W19iEG_XrQmTMi1Je9YlRPM25qrZ2dJZTc5h9S2urzYXXcmC8XNAKKFMKNl-tTk6F4ew",
  dq: "EESORt_-Nty1howIEXpbSuvTWXMGSnkXuwAMh4zDR6jhRUB5Gyfgz_3JQW1Xd93Vr3mqg_ul2uehb5sd_VTnGFCCco1MlcV13NL7AJntwRc-furD3LdXr9Vu6mhlO25uPPrBI58tT4iC_QZD7891NMgRT4uUWqbK0w4xd4CvGAYpWPd77TOuShFYCRWuFSCM8VQe_Vi8aYBtIlQezDl36mYlyvAWpMTftqsGk9VKzZG4wwLoy24gx6Ou94_3Rlvd2OctlMCAtLfFokwupoCeKDeqZywBIuJleUavFZeQLF7GQZB7MznO5DT6XQTq26u1p9hCnqiQT0maTvXaLFycwQ",
  qi: "Fthoo6f2f_oaLSu3jtqXqpQpc2H1w1Ns0XxtyD6fi_wW2r3toXaD6Mz0B3eoz-pH6yCmqbquGO3Vt46U6QHAz44oAXKadpV11QfZdjxrc6jqQ-4wUlqvkaOZrCidKL3t7iYqS6x3Ob1vk4MeaOX62r0FgGJ7TLAJeH1csmH9tFbgMt0Q3hgNf6vMZZ0R1nuRS-vjEqW-SbjH2GDfBTiRjP-LjnA-AvZA-aAJvl8odD0RuY8c66krzd1gS8svN4Nhxrgcdc-LB2bVCP0TiuJtP56XaqHZgxk7pmQivCk7SFjOaiISmAksXqk82GNZKoQQnKHyXU9b-YbZKRYD1SUaCw",
}; // cspell:disable

export const testEthereumWallet = HDNodeWallet.fromPhrase(
  "flame fitness cube rug clown horn ridge indoor cement couple announce weekend"
);

export const paymentDatabase = new PostgresDatabase();
export const dbTestHelper = new DbTestHelper(paymentDatabase);
export const coinGeckoAxios = createAxiosInstance({
  config: { validateStatus: () => true },
});

export const coinGeckoOracle = new CoingeckoTokenToFiatOracle(coinGeckoAxios);
export const arweaveOracle = new ArweaveBytesToWinstonOracle();
export const tokenToFiatOracle = new ReadThroughTokenToFiatOracle({
  oracle: coinGeckoOracle,
});
export const bytesToWinstonOracle = new ReadThroughBytesToWinstonOracle({
  oracle: arweaveOracle,
});
export const stripe = new Stripe("test", { apiVersion: "2023-10-16" });
export const pricingService = new TurboPricingService({
  tokenToFiatOracle,
  bytesToWinstonOracle,
});
export const axios = axiosPackage.create({
  baseURL: localTestUrl,
  validateStatus: () => true,
});
export const emailProvider = new MandrillEmailProvider("test");

const gatewaySettings = { paymentTxPollingWaitTimeMs: 0 };
export const gatewayMap: GatewayMap = {
  arweave: new ArweaveGateway({
    axiosInstance: axios,
    ...gatewaySettings,
  }),
  ethereum: new EthereumGateway(gatewaySettings),
  solana: new SolanaGateway(gatewaySettings),
  ed25519: new SolanaGateway(gatewaySettings),
  kyve: new KyveGateway(gatewaySettings),
  matic: new MaticGateway(gatewaySettings),
  pol: new MaticGateway(gatewaySettings),
  "base-eth": new BaseEthGateway({ ...gatewaySettings }),
  ario: new ARIOGateway({
    ...gatewaySettings,
    jwk: testArweaveWallet,
  }),
};

export const testAddress = "-kYy3_LcYeKhtqNNXDN6xTQ7hW8S5EV0jgq_6j8a830"; // cspell:disable-line

export function removeCatalogIdMap<T extends { catalogId: string }>(
  a: T
): Omit<T, "catalogId"> {
  const { catalogId: _, ...allButCatalogId } = a;
  return allButCatalogId;
}
