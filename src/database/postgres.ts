/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
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
import { randomUUID } from "crypto";
import knex, { Knex } from "knex";
import path from "path";
import winston from "winston";

import logger from "../logger";
import { TransactionId, WC, Winston } from "../types";
import { Database } from "./database";
import { columnNames, tableNames } from "./dbConstants";
import {
  chargebackReceiptDBMap,
  paymentAdjustmentCatalogDBMap,
  paymentReceiptDBMap,
  singleUseCodePaymentCatalogDBMap,
  topUpQuoteDBMap,
  unredeemedGiftDBMap,
  uploadAdjustmentCatalogDBMap,
  userDBMap,
} from "./dbMaps";
import {
  AuditLogInsert,
  BalanceReservationDBInsert,
  BalanceReservationDBResult,
  ChargebackReceipt,
  ChargebackReceiptDBResult,
  CreateBalanceReservationParams,
  CreateChargebackReceiptParams,
  CreatePaymentReceiptParams,
  CreateTopUpQuoteParams,
  FailedTopUpQuoteDBResult,
  PaymentAdjustmentCatalog,
  PaymentAdjustmentCatalogDBResult,
  PaymentAdjustmentDBInsert,
  PaymentAdjustmentDBResult,
  PaymentReceipt,
  PaymentReceiptDBResult,
  PromotionalInfo,
  RedeemedGiftDBInsert,
  RedeemedGiftDBResult,
  SingleUseCodePaymentCatalog,
  SingleUseCodePaymentCatalogDBResult,
  TopUpQuote,
  TopUpQuoteDBInsert,
  TopUpQuoteDBResult,
  UnredeemedGift,
  UnredeemedGiftDBInsert,
  UnredeemedGiftDBResult,
  UploadAdjustmentCatalog,
  UploadAdjustmentCatalogDBResult,
  UploadAdjustmentDBInsert,
  User,
  UserDBInsert,
  UserDBResult,
} from "./dbTypes";
import {
  GiftAlreadyRedeemed,
  GiftRedemptionError,
  InsufficientBalance,
  PromoCodeExceedsMaxUses,
  PromoCodeExpired,
  PromoCodeNotFound,
  UserIneligibleForPromoCode,
  UserNotFoundWarning,
} from "./errors";
import { getReaderConfig, getWriterConfig } from "./knexConfig";

export class PostgresDatabase implements Database {
  private log: winston.Logger;
  private writer: Knex;
  private reader: Knex;

  constructor({
    writer = knex(getWriterConfig()),
    reader = knex(getReaderConfig()),
    migrate = false,
  }: {
    writer?: Knex;
    reader?: Knex;
    migrate?: boolean;
  } = {}) {
    this.log = logger.child({ class: this.constructor.name });

    this.writer = writer;
    this.reader = reader;

    if (migrate) {
      this.log.info("Migrating database...");
      this.writer.migrate
        .latest({ directory: path.join(__dirname, "../migrations") })
        .then(() => this.log.info("Database migration complete."))
        .catch((error) => {
          this.log.error("Failed to migrate database!", error);
        });
    }
  }

  public async createTopUpQuote(
    topUpQuote: CreateTopUpQuoteParams
  ): Promise<void> {
    this.log.info("Inserting new top up quote...", {
      topUpQuote,
    });

    const {
      paymentAmount,
      quotedPaymentAmount,
      adjustments,
      currencyType,
      destinationAddress,
      destinationAddressType,
      paymentProvider,
      quoteExpirationDate,
      topUpQuoteId,
      winstonCreditAmount,
      giftMessage,
    } = topUpQuote;

    const topUpQuoteDbInsert: TopUpQuoteDBInsert = {
      payment_amount: paymentAmount.toString(),
      quoted_payment_amount: quotedPaymentAmount.toString(),
      currency_type: currencyType,
      destination_address: destinationAddress,
      destination_address_type: destinationAddressType,
      payment_provider: paymentProvider,
      quote_expiration_date: quoteExpirationDate,
      top_up_quote_id: topUpQuoteId,
      winston_credit_amount: winstonCreditAmount.toString(),
      gift_message: giftMessage,
    };

    await this.writer.transaction(async (knexTransaction) => {
      await knexTransaction<TopUpQuoteDBResult>(tableNames.topUpQuote).insert(
        topUpQuoteDbInsert
      );

      await knexTransaction.batchInsert(
        tableNames.paymentAdjustment,
        adjustments.map(({ adjustmentAmount, catalogId }, index) => {
          const adjustmentDbInsert: PaymentAdjustmentDBInsert = {
            adjusted_payment_amount: adjustmentAmount.toString(),
            adjusted_currency_type: currencyType,
            user_address: destinationAddress,
            catalog_id: catalogId,
            adjustment_index: index,
            top_up_quote_id: topUpQuoteId,
          };
          return adjustmentDbInsert;
        })
      );
    });
  }

  public async getTopUpQuote(topUpQuoteId: string): Promise<TopUpQuote> {
    const topUpQuoteDbResult = await this.reader<TopUpQuoteDBResult>(
      tableNames.topUpQuote
    ).where({
      [columnNames.topUpQuoteId]: topUpQuoteId,
    });
    if (topUpQuoteDbResult.length === 0) {
      throw Error(
        `No top up quote found in database with ID '${topUpQuoteId}'`
      );
    }

    return topUpQuoteDbResult.map(topUpQuoteDBMap)[0];
  }

  public async updatePromoInfo(
    userAddress: string,
    promoInfo: PromotionalInfo
  ): Promise<void> {
    await this.writer.transaction(async (knexTransaction) => {
      await this.getUser(userAddress, knexTransaction);

      await knexTransaction<UserDBResult>(tableNames.user)
        .where({
          user_address: userAddress,
        })
        .update({ promotional_info: promoInfo });
    });
  }

  public async getPromoInfo(userAddress: string): Promise<PromotionalInfo> {
    const promoInfo = (await this.getUser(userAddress)).promotionalInfo;
    this.log.info("promo info:", { type: typeof promoInfo, promoInfo });
    return promoInfo;
  }

  public async getUser(
    userAddress: string,
    knexTransaction: Knex.Transaction = this.reader as Knex.Transaction
  ): Promise<User> {
    const userDbResult = await knexTransaction<UserDBResult>(
      tableNames.user
    ).where({
      user_address: userAddress,
    });

    if (userDbResult.length === 0) {
      throw new UserNotFoundWarning(userAddress);
    }

    return userDbResult.map(userDBMap)[0];
  }

  public async getBalance(userAddress: string): Promise<WC> {
    // TODO: getBalance should be the result of current_winc_balance - all pending balance_reservation.reserved_winc_amount once finalized_reservations are implemented
    return (await this.getUser(userAddress)).winstonCreditBalance;
  }

  public async createPaymentReceipt(
    paymentReceipt: CreatePaymentReceiptParams
  ): Promise<void | UnredeemedGift> {
    this.log.info("Inserting new payment receipt...", {
      paymentReceipt,
    });

    const {
      topUpQuoteId,
      paymentReceiptId,
      paymentAmount,
      currencyType,
      senderEmail,
    } = paymentReceipt;

    return this.writer.transaction(async (knexTransaction) => {
      const topUpQuoteDbResults = await knexTransaction<TopUpQuoteDBResult>(
        tableNames.topUpQuote
      ).where({
        top_up_quote_id: topUpQuoteId,
      });
      if (topUpQuoteDbResults.length === 0) {
        throw Error(
          `No top up quote found in database with id '${topUpQuoteId}'`
        );
      }

      const {
        payment_amount,
        currency_type,
        destination_address,
        destination_address_type,
        winston_credit_amount,
        quote_expiration_date,
      } = topUpQuoteDbResults[0];

      if (new Date(quote_expiration_date).getTime() < new Date().getTime()) {
        throw Error(
          `Top up quote with id '${topUpQuoteId}' has already been expired!`
        );
      }

      if (paymentAmount < +payment_amount || currencyType !== currency_type) {
        throw Error(
          `Amount from top up quote (${payment_amount} ${currency_type}) does not match the amount paid on the payment receipt (${paymentAmount} ${currencyType})!`
        );
      }

      // Check adjustment eligibility
      const paymentAdjustmentDbResults =
        await knexTransaction<PaymentAdjustmentDBResult>(
          tableNames.paymentAdjustment
        ).where({
          top_up_quote_id: topUpQuoteId,
        });

      for (const { catalog_id } of paymentAdjustmentDbResults) {
        // Check the single use promo code table for any matching adjustment catalogs
        const singleUseAdjustmentCatalog =
          await knexTransaction<SingleUseCodePaymentCatalogDBResult>(
            tableNames.singleUseCodePaymentAdjustmentCatalog
          )
            .where({
              catalog_id,
            })
            .first();

        if (singleUseAdjustmentCatalog !== undefined) {
          // If one is found, check if the user is still eligible for this promo code since the quote was created
          await this.assertCodeEligibility(
            destination_address,
            singleUseAdjustmentCatalog,
            knexTransaction
          );
        }
      }

      // Delete top up quote
      const topUpQuote = await knexTransaction<TopUpQuoteDBResult>(
        tableNames.topUpQuote
      )
        .where({
          top_up_quote_id: topUpQuoteId,
        })
        .del()
        .returning("*");

      // Re-insert as payment receipt
      await knexTransaction<PaymentReceiptDBResult>(
        tableNames.paymentReceipt
      ).insert({ ...topUpQuote[0], payment_receipt_id: paymentReceiptId });

      if (destination_address_type === "email") {
        const unredeemedGiftDbInsert: UnredeemedGiftDBInsert = {
          recipient_email: destination_address,
          payment_receipt_id: paymentReceiptId,
          gifted_winc_amount: winston_credit_amount,
          gift_message: topUpQuote[0].gift_message,
          sender_email: senderEmail,
        };
        const unredeemedGiftDbResult =
          await knexTransaction<UnredeemedGiftDBResult>(
            tableNames.unredeemedGift
          )
            .insert(unredeemedGiftDbInsert)
            .returning("*");

        const auditLogInsert: AuditLogInsert = {
          user_address: destination_address,
          winston_credit_amount: "0",
          change_reason: "gifted_payment",
          change_id: paymentReceiptId,
        };
        await knexTransaction(tableNames.auditLog).insert(auditLogInsert);

        return unredeemedGiftDbResult.map(unredeemedGiftDBMap)[0];
      } else {
        const destinationUser = (
          await knexTransaction<UserDBResult>(tableNames.user).where({
            user_address: destination_address,
          })
        )[0];

        if (destinationUser === undefined) {
          this.log.info("No existing user was found; creating new user...", {
            userAddress: destination_address,
            newBalance: winston_credit_amount,
            paymentReceipt,
          });
          await knexTransaction<UserDBResult>(tableNames.user).insert({
            user_address: destination_address,
            user_address_type: destination_address_type,
            winston_credit_balance: winston_credit_amount,
          });

          const auditLogInsert: AuditLogInsert = {
            user_address: destination_address,
            winston_credit_amount,
            change_reason: "account_creation",
            change_id: paymentReceiptId,
          };
          await knexTransaction(tableNames.auditLog).insert(auditLogInsert);
        } else {
          // Increment balance of existing user
          const currentBalance = new Winston(
            destinationUser.winston_credit_balance
          );
          const newBalance = currentBalance.plus(
            new Winston(winston_credit_amount)
          );

          this.log.info("Incrementing balance...", {
            userAddress: destination_address,
            currentBalance,
            newBalance,
            paymentReceipt,
          });

          await knexTransaction<UserDBResult>(tableNames.user)
            .where({
              user_address: destination_address,
            })
            .update({ winston_credit_balance: newBalance.toString() });

          const auditLogInsert: AuditLogInsert = {
            user_address: destination_address,
            winston_credit_amount,
            change_reason: "payment",
            change_id: paymentReceiptId,
          };
          await knexTransaction(tableNames.auditLog).insert(auditLogInsert);
        }
        return;
      }
    });
  }

  public async redeemGift({
    destinationAddress,
    paymentReceiptId,
    recipientEmail,
  }: {
    paymentReceiptId: string;
    recipientEmail: string;
    destinationAddress: string;
  }): Promise<User> {
    return this.writer.transaction(async (knexTransaction) => {
      const unredeemedGiftDbResults =
        await knexTransaction<UnredeemedGiftDBResult>(
          tableNames.unredeemedGift
        ).where({
          payment_receipt_id: paymentReceiptId,
        });

      if (unredeemedGiftDbResults.length === 0) {
        logger.warn(
          `No unredeemed gift found in database with payment receipt ID '${paymentReceiptId}'`
        );

        const redeemedDbResults = await knexTransaction<RedeemedGiftDBResult>(
          tableNames.redeemedGift
        ).where({
          payment_receipt_id: paymentReceiptId,
        });
        if (redeemedDbResults.length > 0) {
          logger.warn(
            `Payment receipt ID '${paymentReceiptId}' has already been redeemed!`
          );
          throw new GiftAlreadyRedeemed();
        }

        throw new GiftRedemptionError();
      }

      const paymentReceiptDbResults =
        await knexTransaction<PaymentReceiptDBResult>(
          tableNames.paymentReceipt
        ).where({
          payment_receipt_id: paymentReceiptId,
        });

      if (paymentReceiptDbResults.length === 0) {
        logger.warn(
          `No payment receipt found in database with payment receipt ID '${paymentReceiptId}'`
        );
        throw new GiftRedemptionError();
      }

      const unredeemedGiftDbResult = unredeemedGiftDbResults[0];

      if (unredeemedGiftDbResult.recipient_email !== recipientEmail) {
        logger.warn(
          `Recipient email '${recipientEmail}' does not match unredeemed gift recipient email '${unredeemedGiftDbResult.recipient_email}'`
        );
        throw new GiftRedemptionError();
      }

      const redeemedGiftDbInsert: RedeemedGiftDBInsert = {
        ...unredeemedGiftDbResult,
        destination_address: destinationAddress,
      };

      await knexTransaction(tableNames.unredeemedGift)
        .where({
          payment_receipt_id: paymentReceiptId,
        })
        .del();

      await knexTransaction(tableNames.redeemedGift).insert(
        redeemedGiftDbInsert
      );

      const destinationUser = (
        await knexTransaction<UserDBResult>(tableNames.user).where({
          user_address: destinationAddress,
        })
      )[0];

      if (destinationUser === undefined) {
        this.log.info("No existing user was found; creating new user...", {
          userAddress: destinationAddress,
          newBalance: unredeemedGiftDbResult.gifted_winc_amount,
        });
        const userDbInsert: UserDBInsert = {
          user_address: destinationAddress,
          user_address_type: "arweave",
          winston_credit_balance: unredeemedGiftDbResult.gifted_winc_amount,
        };
        const userDbResult = await knexTransaction<UserDBResult>(
          tableNames.user
        )
          .insert(userDbInsert)
          .returning("*");

        const auditLogInsert: AuditLogInsert = {
          user_address: destinationAddress,
          winston_credit_amount: unredeemedGiftDbResult.gifted_winc_amount,
          change_reason: "gifted_account_creation",
          change_id: paymentReceiptId,
        };
        await knexTransaction(tableNames.auditLog).insert(auditLogInsert);
        return userDbResult.map(userDBMap)[0];
      } else {
        // Increment balance of existing user
        const currentBalance = new Winston(
          destinationUser.winston_credit_balance
        );
        const newBalance = currentBalance.plus(
          new Winston(unredeemedGiftDbResult.gifted_winc_amount)
        );

        this.log.info("Incrementing balance...", {
          userAddress: destinationAddress,
          currentBalance,
          newBalance,
        });

        const userDbResult = await knexTransaction<UserDBResult>(
          tableNames.user
        )
          .where({
            user_address: destinationAddress,
          })
          .update({ winston_credit_balance: newBalance.toString() })
          .returning("*");

        const auditLogInsert: AuditLogInsert = {
          user_address: destinationAddress,
          winston_credit_amount: unredeemedGiftDbResult.gifted_winc_amount,
          change_reason: "gifted_payment_redemption",
          change_id: paymentReceiptId,
        };
        await knexTransaction(tableNames.auditLog).insert(auditLogInsert);

        return userDbResult.map(userDBMap)[0];
      }
    });
  }

  public async getPaymentReceipt(
    paymentReceiptId: string,
    knexTransaction: Knex.Transaction = this.reader as Knex.Transaction
  ): Promise<PaymentReceipt> {
    return this.getPaymentReceiptWhere(
      { [columnNames.paymentReceiptId]: paymentReceiptId },
      knexTransaction
    );
  }

  private async getPaymentReceiptByTopUpQuoteId(
    topUpQuoteId: string,
    knexTransaction: Knex.Transaction = this.reader as Knex.Transaction
  ): Promise<PaymentReceipt> {
    return this.getPaymentReceiptWhere(
      { [columnNames.topUpQuoteId]: topUpQuoteId },
      knexTransaction
    );
  }

  private async getPaymentReceiptWhere(
    where: Partial<PaymentReceiptDBResult>,
    knexTransaction: Knex.Transaction = this.reader as Knex.Transaction
  ): Promise<PaymentReceipt> {
    const paymentReceiptDbResults =
      await knexTransaction<PaymentReceiptDBResult>(
        tableNames.paymentReceipt
      ).where(where);

    if (paymentReceiptDbResults.length === 0) {
      throw Error(
        `No payment receipts found in database with query ${JSON.stringify(
          where
        )}!`
      );
    }

    return paymentReceiptDbResults.map(paymentReceiptDBMap)[0];
  }

  private async getChargebackReceiptWhere(
    where: Partial<ChargebackReceiptDBResult>,
    knexTransaction: Knex.Transaction = this.reader as Knex.Transaction
  ): Promise<ChargebackReceipt[]> {
    const chargebackReceiptDbResult =
      await knexTransaction<ChargebackReceiptDBResult>(
        tableNames.chargebackReceipt
      ).where(where);

    return chargebackReceiptDbResult.map(chargebackReceiptDBMap);
  }

  public async getChargebackReceiptsForAddress(
    userAddress: string
  ): Promise<ChargebackReceipt[]> {
    return this.getChargebackReceiptWhere({
      destination_address: userAddress,
    });
  }

  public async createChargebackReceipt({
    topUpQuoteId,
    chargebackReason,
    chargebackReceiptId,
  }: CreateChargebackReceiptParams): Promise<void> {
    this.log.info("Inserting new chargeback receipt...", {
      topUpQuoteId,
    });

    await this.writer.transaction(async (knexTransaction) => {
      // This will throw if payment receipt does not exist
      const {
        destinationAddress,
        paymentReceiptId,
        winstonCreditAmount: winstonClawbackAmount,
        destinationAddressType,
      } = await this.getPaymentReceiptByTopUpQuoteId(
        topUpQuoteId,
        knexTransaction
      );

      let userAddress: string | undefined;

      if (destinationAddressType === "email") {
        const redeemedGiftDbResults =
          await knexTransaction<RedeemedGiftDBResult>(
            tableNames.unredeemedGift
          ).where({
            payment_receipt_id: paymentReceiptId,
          });

        if (redeemedGiftDbResults.length === 0) {
          // When no redeemed exists yet, delete the unredeemed gift and leave user address undefined
          await knexTransaction<UnredeemedGiftDBResult>(
            tableNames.unredeemedGift
          )
            .where({
              payment_receipt_id: paymentReceiptId,
            })
            .del();
        } else {
          userAddress = redeemedGiftDbResults[0].destination_address;
        }
      } else {
        userAddress = destinationAddress;
      }

      if (userAddress) {
        const user = await this.getUser(userAddress, knexTransaction);

        // Decrement balance of existing user
        const currentBalance = user.winstonCreditBalance;

        // this could result in a negative balance for a user, will throw an error if non-integer winston balance
        const newBalance = currentBalance.minus(winstonClawbackAmount);

        // Update the users balance.
        await knexTransaction<UserDBResult>(tableNames.user)
          .where({
            user_address: destinationAddress,
          })
          .update({ winston_credit_balance: newBalance.toString() });

        const auditLogInsert: AuditLogInsert = {
          user_address: destinationAddress,
          winston_credit_amount: `-${winstonClawbackAmount.toString()}`, // a negative value because this amount was withdrawn from the users balance
          change_reason: "chargeback",
          change_id: chargebackReceiptId,
        };
        await knexTransaction(tableNames.auditLog).insert(auditLogInsert);
      } else {
        logger.warn(
          `Chargeback receipt created for payment receipt ID '${paymentReceiptId}' but user has not redeemed gift yet!`
        );
      }

      // Remove from payment receipt table,
      const paymentReceiptDbResult =
        await knexTransaction<PaymentReceiptDBResult>(tableNames.paymentReceipt)
          .where({ payment_receipt_id: paymentReceiptId })
          .del()
          .returning("*");

      // Create Chargeback Receipt
      await knexTransaction<ChargebackReceiptDBResult>(
        tableNames.chargebackReceipt
      ).insert({
        ...paymentReceiptDbResult[0],
        chargeback_reason: chargebackReason,
        chargeback_receipt_id: chargebackReceiptId,
      });
    });
  }

  public async getChargebackReceipt(
    chargebackReceiptId: string
  ): Promise<ChargebackReceipt> {
    const chargebackReceiptDbResult =
      await this.reader<ChargebackReceiptDBResult>(
        tableNames.chargebackReceipt
      ).where({
        [columnNames.chargebackReceiptId]: chargebackReceiptId,
      });
    if (chargebackReceiptDbResult.length === 0) {
      throw Error(
        `No chargeback receipt found in database with ID '${chargebackReceiptId}'`
      );
    }

    return chargebackReceiptDbResult.map(chargebackReceiptDBMap)[0];
  }

  public async reserveBalance({
    userAddress,
    networkWincAmount,
    reservedWincAmount,
    dataItemId,
    adjustments = [],
  }: CreateBalanceReservationParams): Promise<void> {
    await this.writer.transaction(async (knexTransaction) => {
      const user = await this.getUser(userAddress, knexTransaction);

      const currentWinstonBalance = user.winstonCreditBalance;
      const newBalance = currentWinstonBalance.minus(reservedWincAmount.winc);

      // throw insufficient balance error if the user would go to a negative balance
      if (newBalance.isNonZeroNegativeInteger()) {
        throw new InsufficientBalance(userAddress);
      }

      const reservationId = randomUUID();

      const balanceReservationDbInsert: BalanceReservationDBInsert = {
        reservation_id: reservationId,
        data_item_id: dataItemId,
        reserved_winc_amount: reservedWincAmount.toString(),
        network_winc_amount: networkWincAmount.toString(),
        user_address: userAddress,
      };

      await knexTransaction<BalanceReservationDBResult>(
        tableNames.balanceReservation
      ).insert(balanceReservationDbInsert);

      await knexTransaction.batchInsert(
        tableNames.uploadAdjustment,
        adjustments.map(({ adjustmentAmount, catalogId }, index) => {
          const adjustmentDbInsert: UploadAdjustmentDBInsert = {
            adjusted_winc_amount: adjustmentAmount.toString(),
            user_address: userAddress,
            catalog_id: catalogId,
            adjustment_index: index,
            reservation_id: reservationId,
          };
          return adjustmentDbInsert;
        })
      );

      // TODO: Move this decrement balance onto finalized_reservation once implemented
      await knexTransaction<UserDBResult>(tableNames.user)
        .where({
          user_address: userAddress,
        })
        .update({ winston_credit_balance: newBalance.toString() });

      const auditLogInsert: AuditLogInsert = {
        user_address: userAddress,
        winston_credit_amount: `-${reservedWincAmount.toString()}`, // a negative value because this amount was withdrawn from the users balance
        change_reason: "upload",
        change_id: dataItemId,
      };
      await knexTransaction(tableNames.auditLog).insert(auditLogInsert);
    });
  }

  public async refundBalance(
    userAddress: string,
    winstonCreditAmount: Winston,
    dataItemId?: TransactionId
  ): Promise<void> {
    await this.writer.transaction(async (knexTransaction) => {
      const user = await this.getUser(userAddress, knexTransaction);

      const currentWinstonBalance = user.winstonCreditBalance;
      const newBalance = currentWinstonBalance.plus(winstonCreditAmount);

      await knexTransaction<UserDBResult>(tableNames.user)
        .where({
          user_address: userAddress,
        })
        .update({ winston_credit_balance: newBalance.toString() });

      const auditLogInsert: AuditLogInsert = {
        user_address: userAddress,
        winston_credit_amount: winstonCreditAmount.toString(), // a positive value because this amount was incremented to the users balance
        change_reason: "refund",
        change_id: dataItemId,
      };
      await knexTransaction(tableNames.auditLog).insert(auditLogInsert);
    });
  }

  public async checkForExistingPaymentByTopUpQuoteId(
    top_up_quote_id: string
  ): Promise<boolean> {
    return this.reader.transaction(async (knexTransaction) => {
      const [
        paymentReceiptResult,
        chargebackReceiptResult,
        failedTopUpQuoteReceiptResult,
      ] = await Promise.all([
        knexTransaction<PaymentReceiptDBResult>(
          tableNames.paymentReceipt
        ).where({ top_up_quote_id }),
        knexTransaction<ChargebackReceiptDBResult>(
          tableNames.chargebackReceipt
        ).where({
          top_up_quote_id,
        }),
        knexTransaction<FailedTopUpQuoteDBResult>(
          tableNames.failedTopUpQuote
        ).where({ top_up_quote_id }),
      ]);
      return (
        !!paymentReceiptResult.length ||
        !!chargebackReceiptResult.length ||
        !!failedTopUpQuoteReceiptResult.length ||
        false
      );
    });
  }

  public async getUploadAdjustmentCatalogs(): Promise<
    UploadAdjustmentCatalog[]
  > {
    const currentDate = new Date().toISOString();
    return (
      await this.reader<UploadAdjustmentCatalogDBResult>(
        tableNames.uploadAdjustmentCatalog
      )
        .whereRaw(
          `'${currentDate}' >= ${columnNames.adjustmentStartDate} and (
          ${columnNames.adjustmentEndDate} is null or '${currentDate}' < ${columnNames.adjustmentEndDate}
        )`
        )
        .orderBy(columnNames.adjustmentPriority, "asc")
    ).map(uploadAdjustmentCatalogDBMap);
  }

  public async getPaymentAdjustmentCatalogs(): Promise<
    PaymentAdjustmentCatalog[]
  > {
    const currentDate = new Date().toISOString();
    return (
      await this.reader<PaymentAdjustmentCatalogDBResult>(
        tableNames.paymentAdjustmentCatalog
      )
        .whereRaw(
          `'${currentDate}' >= ${columnNames.adjustmentStartDate} and (
          ${columnNames.adjustmentEndDate} is null or '${currentDate}' < ${columnNames.adjustmentEndDate}
        )`
        )
        .orderBy(columnNames.adjustmentPriority, "asc")
    ).map(paymentAdjustmentCatalogDBMap);
  }

  private async checkForSingleUsePromoCodeEligibility(
    userAddress: string,
    catalogId: string,
    knexTransaction: Knex.Transaction
  ): Promise<boolean> {
    const existingAdjustments =
      await knexTransaction<PaymentAdjustmentDBResult>(
        tableNames.paymentAdjustment
      ).where({
        user_address: userAddress,
        catalog_id: catalogId,
      });

    const existingPaymentReceiptPromises = existingAdjustments.map(
      ({ top_up_quote_id }) =>
        knexTransaction<PaymentReceiptDBResult>(
          tableNames.paymentReceipt
        ).where({
          top_up_quote_id,
        })
    );

    const existingPaymentReceiptDbResults = await Promise.all(
      existingPaymentReceiptPromises
    );

    return existingPaymentReceiptDbResults.every(
      (paymentReceiptDbResults) => paymentReceiptDbResults.length === 0
    );
  }

  private async checkForNewUsersCodeEligibility(
    userAddress: string,
    knexTransaction: Knex.Transaction
  ): Promise<boolean> {
    const existingPaymentReceipts =
      await knexTransaction<PaymentReceiptDBResult>(
        tableNames.paymentReceipt
      ).where({
        destination_address: userAddress,
      });

    return existingPaymentReceipts.length === 0;
  }

  private async assertCodeEligibility(
    userAddress: string,
    {
      catalog_id,
      code_value,
      target_user_group,
      max_uses,
      adjustment_end_date,
    }: SingleUseCodePaymentCatalogDBResult,
    knexTransaction: Knex.Transaction
  ): Promise<void> {
    if (adjustment_end_date && new Date() > new Date(adjustment_end_date)) {
      throw new PromoCodeExpired(code_value, adjustment_end_date);
    }

    // 0 max uses means unlimited
    if (max_uses > 0) {
      const existingAdjustments =
        await knexTransaction<PaymentAdjustmentDBResult>(
          tableNames.paymentAdjustment
        ).where({
          catalog_id,
        });

      if (existingAdjustments.length >= max_uses) {
        throw new PromoCodeExceedsMaxUses(code_value, max_uses);
      }
    }
    const isEligible =
      target_user_group === "new"
        ? await this.checkForNewUsersCodeEligibility(
            userAddress,
            knexTransaction
          )
        : await this.checkForSingleUsePromoCodeEligibility(
            userAddress,
            catalog_id,
            knexTransaction
          );
    if (!isEligible) {
      throw new UserIneligibleForPromoCode(userAddress, code_value);
    }
  }

  public async getSingleUsePromoCodeAdjustments(
    promoCodes: string[],
    userAddress: string
  ): Promise<SingleUseCodePaymentCatalog[]> {
    if (promoCodes.length === 0) {
      return [];
    }
    return this.reader.transaction(async (knexTransaction) => {
      const currentDate = new Date().toISOString();
      const promoCodeAdjustments =
        await knexTransaction<SingleUseCodePaymentCatalogDBResult>(
          tableNames.singleUseCodePaymentAdjustmentCatalog
        )
          .whereRaw(`'${currentDate}' >= ${columnNames.adjustmentStartDate}`)
          .orderBy(columnNames.adjustmentPriority, "asc");

      const qualifiedAdjustments: SingleUseCodePaymentCatalogDBResult[] = [];

      for (let i = 0; i < promoCodes.length; i++) {
        const code = promoCodes[i];

        const matchingAdjustments = promoCodeAdjustments.filter(
          (a) => a.code_value === code
        );
        if (matchingAdjustments.length === 0) {
          throw new PromoCodeNotFound(code);
        }

        // When matching multiple codes, only use and validate against the adjustment with the most recent start date
        const promoCodeAdjustment = matchingAdjustments.sort((a, b) => {
          return (
            new Date(b.adjustment_start_date).getTime() -
            new Date(a.adjustment_start_date).getTime()
          );
        })[0];

        await this.assertCodeEligibility(
          userAddress,
          promoCodeAdjustment,
          knexTransaction
        );

        qualifiedAdjustments.push(promoCodeAdjustment);
      }

      return qualifiedAdjustments.map(singleUseCodePaymentCatalogDBMap);
    });
  }
}
