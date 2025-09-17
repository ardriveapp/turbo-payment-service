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
import { randomUUID } from "crypto";
import knex, { Knex } from "knex";
import path from "path";
import winston from "winston";

import globalLogger from "../logger";
import { TransactionId, W, WC, Winston } from "../types";
import { remainingWincAmountFromApprovals } from "../utils/common";
import { Database, WincUsedForUploadAdjustmentParams } from "./database";
import { columnNames, tableNames } from "./dbConstants";
import {
  arnsPurchaseDBMap,
  arnsPurchaseQuoteDBInsertFromParams,
  arnsPurchaseQuoteDBMap,
  arnsPurchaseReceiptDBMap,
  chargebackReceiptDBMap,
  creditedTransactionDBMap,
  delegatedPaymentApprovalDBMap,
  failedTransactionDBMap,
  inactiveDelegatedPaymentApprovalDBMap,
  paymentAdjustmentCatalogDBMap,
  paymentReceiptDBMap,
  pendingPaymentTransactionDBMap,
  singleUseCodePaymentCatalogDBMap,
  topUpQuoteDBMap,
  unredeemedGiftDBMap,
  uploadAdjustmentCatalogDBMap,
  userDBMap,
} from "./dbMaps";
import {
  ArNSPurchase,
  ArNSPurchaseDBInsert,
  ArNSPurchaseDBResult,
  ArNSPurchaseParams,
  ArNSPurchaseQuote,
  ArNSPurchaseQuoteDBResult,
  ArNSPurchaseQuoteParams,
  ArNSPurchaseStatusResult,
  AuditChangeReason,
  AuditLogInsert,
  BalanceReservationDBInsert,
  BalanceReservationDBResult,
  ChargebackReceipt,
  ChargebackReceiptDBResult,
  CreateBalanceReservationParams,
  CreateBypassedPaymentReceiptParams,
  CreateChargebackReceiptParams,
  CreateDelegatedPaymentApprovalParams,
  CreateNewCreditedTransactionParams,
  CreatePaymentReceiptParams,
  CreatePendingTransactionParams,
  CreateTopUpQuoteParams,
  CreditedPaymentTransaction,
  CreditedPaymentTransactionDBInsert,
  CreditedPaymentTransactionDBResult,
  DataItemId,
  DelegatedPaymentApproval,
  DelegatedPaymentApprovalDBInsert,
  DelegatedPaymentApprovalDBResult,
  FailedArNSPurchaseDBInsert,
  FailedArNSPurchaseDBResult,
  FailedPaymentTransaction,
  FailedPaymentTransactionDBInsert,
  FailedPaymentTransactionDBResult,
  FailedTopUpQuoteDBResult,
  GetBalanceResult,
  InactiveDelegatedPaymentApproval,
  InactiveDelegatedPaymentApprovalDBInsert,
  InactiveDelegatedPaymentApprovalDBResult,
  KnexTransaction,
  OverflowSpendDBResult,
  PaymentAdjustment,
  PaymentAdjustmentCatalog,
  PaymentAdjustmentCatalogDBResult,
  PaymentAdjustmentDBInsert,
  PaymentAdjustmentDBResult,
  PaymentDirective,
  PaymentReceipt,
  PaymentReceiptDBInsert,
  PaymentReceiptDBResult,
  PendingPaymentTransaction,
  PendingPaymentTransactionDBInsert,
  PendingPaymentTransactionDBResult,
  PendingSpend,
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
  UploadAdjustmentDBResult,
  User,
  UserAddress,
  UserAddressType,
  UserDBInsert,
  UserDBResult,
  isCreditedPaymentTransactionDBResult,
  isFailedPaymentTransactionDBResult,
} from "./dbTypes";
import {
  ArNSPurchaseAlreadyExists,
  ArNSPurchaseNotFound,
  ConflictingApprovalFound,
  GiftAlreadyRedeemed,
  GiftRedemptionError,
  InsufficientBalance,
  NoApprovalsFound,
  PaymentTransactionNotFound,
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
    logger = globalLogger,
  }: {
    writer?: Knex;
    reader?: Knex;
    migrate?: boolean;
    logger?: winston.Logger;
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
    this.log.debug("Database initialized.", {
      writer: this.writer.client.config.connection,
      reader: this.reader.client.config.connection,
    });
  }
  public async createTopUpQuote(
    topUpQuote: CreateTopUpQuoteParams
  ): Promise<void> {
    this.log.debug("Inserting new top up quote...", {
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
    this.log.debug("promo info:", { type: typeof promoInfo, promoInfo });
    return promoInfo;
  }

  public async getUser(
    userAddress: string,
    knexTransaction: KnexTransaction = this.reader
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

  public async getBalance(
    userAddress: string,
    knexTransaction: KnexTransaction = this.reader
  ): Promise<GetBalanceResult> {
    // TODO: getBalance should be the result of current_winc_balance - all pending balance_reservation.reserved_winc_amount once finalized_reservations are implemented

    const { receivedApprovals, givenApprovals } =
      await this.getAllApprovalsForUserAddress(userAddress, knexTransaction);

    const remainingBalanceFromReceivedApprovals =
      remainingWincAmountFromApprovals(receivedApprovals);
    const remainingBalanceFromGivenApprovals =
      remainingWincAmountFromApprovals(givenApprovals);

    try {
      const user = await this.getUser(userAddress, knexTransaction);

      const winc = user.winstonCreditBalance;
      const controlledWinc = winc.plus(remainingBalanceFromGivenApprovals);
      const effectiveBalance = winc.plus(remainingBalanceFromReceivedApprovals);

      return {
        controlledWinc,
        givenApprovals,
        winc,
        receivedApprovals,
        effectiveBalance,
      };
    } catch (error) {
      if (error instanceof UserNotFoundWarning) {
        if (
          remainingBalanceFromReceivedApprovals.isGreaterThanOrEqualTo(W(1))
        ) {
          // When user is not found, but has a positive balance from approvals
          // we will gracefully return the effective balance and approvals
          return {
            winc: new Winston("0"),
            givenApprovals,
            controlledWinc: new Winston("0"),
            receivedApprovals,
            effectiveBalance: remainingBalanceFromReceivedApprovals,
          };
        }
      }
      throw error;
    }
  }

  public async createPaymentReceipt(
    paymentReceipt: CreatePaymentReceiptParams
  ): Promise<void | UnredeemedGift> {
    this.log.debug("Inserting new payment receipt...", {
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
          this.log.debug("No existing user was found; creating new user...", {
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

          this.log.debug("Incrementing balance...", {
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

  /**
   *  Creates a batch of payment receipt and its corresponding db entities without the requirement of
   *  a pre-existing top up quote. This is meant as an admin tool for creating bypassed payments
   */
  public async createBypassedPaymentReceipts(
    paymentReceipts: CreateBypassedPaymentReceiptParams[]
  ): Promise<UnredeemedGift[]> {
    this.log.debug("Inserting new bypassed payment receipts...", {
      paymentReceipts,
    });
    return this.writer.transaction(async (knexTransaction) => {
      const unredeemedGifts: UnredeemedGift[] = [];
      for (const paymentReceipt of paymentReceipts) {
        const {
          paymentAmount,
          currencyType,
          destinationAddress,
          destinationAddressType,
          paymentProvider,
          senderEmail,
          winc,
          giftMessage,
        } = paymentReceipt;

        const paymentReceiptId = randomUUID();

        const paymentReceiptDbInsert: PaymentReceiptDBInsert = {
          payment_amount: paymentAmount.toString(),
          currency_type: currencyType,
          destination_address: destinationAddress,
          destination_address_type: destinationAddressType,
          payment_provider: paymentProvider,
          quote_expiration_date: new Date().toISOString(),
          quote_creation_date: new Date().toISOString(),
          payment_receipt_id: paymentReceiptId,
          quoted_payment_amount: paymentAmount.toString(),
          top_up_quote_id: paymentReceiptId,
          winston_credit_amount: winc.toString(),
          gift_message: giftMessage,
        };

        await knexTransaction<PaymentReceiptDBResult>(
          tableNames.paymentReceipt
        ).insert(paymentReceiptDbInsert);

        if (destinationAddressType === "email") {
          const unredeemedGiftDbInsert: UnredeemedGiftDBInsert = {
            recipient_email: destinationAddress,
            payment_receipt_id: paymentReceiptId,
            gifted_winc_amount: winc.toString(),
            gift_message: giftMessage,
            sender_email: senderEmail,
          };
          const unredeemedGift = await knexTransaction<UnredeemedGiftDBResult>(
            tableNames.unredeemedGift
          )
            .insert(unredeemedGiftDbInsert)
            .returning("*");

          const auditLogInsert: AuditLogInsert = {
            user_address: destinationAddress,
            winston_credit_amount: "0",
            change_reason: "bypassed_gifted_payment",
            change_id: paymentReceiptId,
          };

          await knexTransaction(tableNames.auditLog).insert(auditLogInsert);

          unredeemedGifts.push(unredeemedGift.map(unredeemedGiftDBMap)[0]);
        } else {
          // Increment balance of existing user
          const destinationUser = (
            await knexTransaction<UserDBResult>(tableNames.user).where({
              user_address: destinationAddress,
            })
          )[0];

          if (destinationUser === undefined) {
            this.log.debug("No existing user was found; creating new user...", {
              userAddress: destinationAddress,
              newBalance: winc.toString(),
            });
            await knexTransaction<UserDBResult>(tableNames.user).insert({
              user_address: destinationAddress,
              user_address_type: destinationAddressType,
              winston_credit_balance: winc.toString(),
            });

            const auditLogInsert: AuditLogInsert = {
              user_address: destinationAddress,
              winston_credit_amount: winc.toString(),
              change_reason: "bypassed_account_creation",
              change_id: paymentReceiptId,
            };
            await knexTransaction(tableNames.auditLog).insert(auditLogInsert);
          } else {
            // Increment balance of existing user
            const currentBalance = new Winston(
              destinationUser.winston_credit_balance
            );
            const newBalance = currentBalance.plus(winc);

            this.log.debug("Incrementing balance...", {
              userAddress: destinationAddress,
              currentBalance,
              newBalance,
            });

            await knexTransaction<UserDBResult>(tableNames.user)
              .where({
                user_address: destinationAddress,
              })
              .update({ winston_credit_balance: newBalance.toString() });

            const auditLogInsert: AuditLogInsert = {
              user_address: destinationAddress,
              winston_credit_amount: winc.toString(),
              change_reason: "bypassed_payment",
              change_id: paymentReceiptId,
            };

            await knexTransaction(tableNames.auditLog).insert(auditLogInsert);
          }
        }
      }
      return unredeemedGifts;
    });
  }

  public async redeemGift({
    destinationAddress,
    paymentReceiptId,
    recipientEmail,
    destinationAddressType,
  }: {
    paymentReceiptId: string;
    recipientEmail: string;
    destinationAddress: string;
    destinationAddressType: UserAddressType;
  }): Promise<{ user: User; wincRedeemed: WC }> {
    return this.writer.transaction(async (knexTransaction) => {
      const unredeemedGiftDbResults =
        await knexTransaction<UnredeemedGiftDBResult>(
          tableNames.unredeemedGift
        ).where({
          payment_receipt_id: paymentReceiptId,
        });

      if (unredeemedGiftDbResults.length === 0) {
        this.log.warn(
          `No unredeemed gift found in database with payment receipt ID '${paymentReceiptId}'`
        );

        const redeemedDbResults = await knexTransaction<RedeemedGiftDBResult>(
          tableNames.redeemedGift
        ).where({
          payment_receipt_id: paymentReceiptId,
        });
        if (redeemedDbResults.length > 0) {
          this.log.warn(
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
        this.log.warn(
          `No payment receipt found in database with payment receipt ID '${paymentReceiptId}'`
        );
        throw new GiftRedemptionError();
      }

      const unredeemedGiftDbResult = unredeemedGiftDbResults[0];

      if (unredeemedGiftDbResult.recipient_email !== recipientEmail) {
        this.log.warn(
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
        this.log.debug("No existing user was found; creating new user...", {
          userAddress: destinationAddress,
          newBalance: unredeemedGiftDbResult.gifted_winc_amount,
        });
        const userDbInsert: UserDBInsert = {
          user_address: destinationAddress,
          user_address_type: destinationAddressType,
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
        return {
          user: userDbResult.map(userDBMap)[0],
          wincRedeemed: new Winston(unredeemedGiftDbResult.gifted_winc_amount),
        };
      } else {
        // Increment balance of existing user
        const currentBalance = new Winston(
          destinationUser.winston_credit_balance
        );
        const newBalance = currentBalance.plus(
          new Winston(unredeemedGiftDbResult.gifted_winc_amount)
        );

        this.log.debug("Incrementing balance...", {
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

        return {
          user: userDbResult.map(userDBMap)[0],
          wincRedeemed: new Winston(unredeemedGiftDbResult.gifted_winc_amount),
        };
      }
    });
  }

  public async getPaymentReceipt(
    paymentReceiptId: string,
    knexTransaction: KnexTransaction | Knex = this.reader
  ): Promise<PaymentReceipt> {
    return this.getPaymentReceiptWhere(
      { [columnNames.paymentReceiptId]: paymentReceiptId },
      knexTransaction
    );
  }

  private async getPaymentReceiptByTopUpQuoteId(
    topUpQuoteId: string,
    knexTransaction: KnexTransaction = this.reader
  ): Promise<PaymentReceipt> {
    return this.getPaymentReceiptWhere(
      { [columnNames.topUpQuoteId]: topUpQuoteId },
      knexTransaction
    );
  }

  private async getPaymentReceiptWhere(
    where: Partial<PaymentReceiptDBResult>,
    knexTransaction: KnexTransaction = this.reader
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
    knexTransaction: KnexTransaction = this.reader
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
    this.log.debug("Inserting new chargeback receipt...", {
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
        this.log.warn(
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
    signerAddress,
    networkWincAmount,
    reservedWincAmount,
    dataItemId,
    adjustments = [],
    paidBy = [],
    paymentDirective = "list-or-signer",
  }: CreateBalanceReservationParams): Promise<void> {
    await this.writer.transaction(async (knexTransaction) => {
      const reservationId = randomUUID();

      const overflow_spend = await this.useBalanceAndApprovals({
        changeId: dataItemId,
        changeReason: "upload",
        paidBy,
        knexTransaction,
        signerAddress,
        wincAmount: reservedWincAmount.winc,
        paymentDirective,
      });

      const balanceReservationDbInsert: BalanceReservationDBInsert = {
        reservation_id: reservationId,
        data_item_id: dataItemId,
        reserved_winc_amount: reservedWincAmount.toString(),
        network_winc_amount: networkWincAmount.toString(),
        user_address: signerAddress,
        overflow_spend: JSON.stringify(overflow_spend),
      };
      await knexTransaction<BalanceReservationDBInsert>(
        tableNames.balanceReservation
      ).insert(balanceReservationDbInsert);

      const batchUploadAdjustmentInserts: UploadAdjustmentDBInsert[] =
        adjustments.map(({ adjustmentAmount, catalogId }, index) => ({
          adjusted_winc_amount: adjustmentAmount.toString(),
          user_address: signerAddress,
          catalog_id: catalogId,
          adjustment_index: index,
          reservation_id: reservationId,
        }));
      await knexTransaction.batchInsert(
        tableNames.uploadAdjustment,
        batchUploadAdjustmentInserts
      );
    });
  }

  public async refundBalance(
    signerAddress: string,
    winstonCreditAmount: Winston,
    dataItemId: TransactionId
  ): Promise<void> {
    await this.writer.transaction(async (knexTransaction) => {
      const reservation = await knexTransaction<BalanceReservationDBResult>(
        tableNames.balanceReservation
      )
        .where({
          data_item_id: dataItemId,
        })
        .orderBy("reserved_date", "desc")
        .first();
      await this.refundWincFromOverflowSpend({
        signerAddress,
        wincAmount: winstonCreditAmount,
        changeId: dataItemId,
        changeReason: "refunded_upload",
        knexTransaction,
        overflowSpend: reservation?.overflow_spend,
      });
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
    knexTransaction: KnexTransaction
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
    knexTransaction: KnexTransaction
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
    knexTransaction: KnexTransaction
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

  private insertPaymentAdjustments(
    knexTransaction: KnexTransaction,
    adjustments: PaymentAdjustment[],
    userAddress: string,
    paymentId: string
  ) {
    return knexTransaction.batchInsert(
      tableNames.paymentAdjustment,
      adjustments.map(
        ({ adjustmentAmount, catalogId, currencyType }, index) => {
          const adjustmentDbInsert: PaymentAdjustmentDBInsert = {
            adjusted_payment_amount: adjustmentAmount.toString(),
            adjusted_currency_type: currencyType,
            user_address: userAddress,
            catalog_id: catalogId,
            adjustment_index: index,
            top_up_quote_id: paymentId,
          };
          return adjustmentDbInsert;
        }
      )
    );
  }

  public async createPendingTransaction(
    params: CreatePendingTransactionParams
  ): Promise<void> {
    this.log.debug("Inserting new pending transaction...", params);

    const {
      destinationAddress,
      winstonCreditAmount,
      adjustments,
      destinationAddressType,
      transactionId,
      transactionQuantity,
      tokenType,
    } = params;

    await this.writer.transaction(async (knexTransaction) => {
      const pendingTransactionDbInsert: PendingPaymentTransactionDBInsert = {
        destination_address: destinationAddress,
        winston_credit_amount: winstonCreditAmount.toString(),
        destination_address_type: destinationAddressType,
        transaction_id: transactionId,
        transaction_quantity: transactionQuantity.toString(),
        token_type: tokenType,
      };

      await knexTransaction<PendingPaymentTransactionDBResult>(
        tableNames.pendingPaymentTransaction
      ).insert(pendingTransactionDbInsert);

      await this.insertPaymentAdjustments(
        knexTransaction,
        adjustments,
        destinationAddress,
        transactionId
      );
    });
  }

  public async creditPendingTransaction(
    transactionId: string,
    blockHeight: number
  ): Promise<void> {
    await this.writer.transaction(async (knexTransaction) => {
      const pendingTransactionDbResults =
        await knexTransaction<PendingPaymentTransactionDBResult>(
          tableNames.pendingPaymentTransaction
        )
          .where({
            transaction_id: transactionId,
          })
          .del()
          .returning("*");

      if (pendingTransactionDbResults.length === 0) {
        throw new PaymentTransactionNotFound(transactionId);
      }

      const pendingTransaction = pendingTransactionDbResults[0];

      const creditedTransactionDbInsert: CreditedPaymentTransactionDBInsert = {
        ...pendingTransaction,
        block_height: blockHeight,
      };

      await knexTransaction<CreditedPaymentTransactionDBResult>(
        tableNames.creditedPaymentTransaction
      ).insert(creditedTransactionDbInsert);

      await this.creditOrCreateUser({
        userAddress: pendingTransaction.destination_address,
        userAddressType:
          pendingTransaction.destination_address_type as UserAddressType,
        changeReason: "crypto_payment",
        changeId: transactionId,
        winstonCreditAmount: new Winston(
          pendingTransaction.winston_credit_amount
        ),
        knexTransaction,
      });
    });
  }

  public async failPendingTransaction(
    transactionId: string,
    failedReason: string
  ): Promise<void> {
    await this.writer.transaction(async (knexTransaction) => {
      const pendingTransactionDbResults =
        await knexTransaction<PendingPaymentTransactionDBResult>(
          tableNames.pendingPaymentTransaction
        )
          .where({
            transaction_id: transactionId,
          })
          .del()
          .returning("*");

      if (pendingTransactionDbResults.length === 0) {
        throw new PaymentTransactionNotFound(transactionId);
      }

      const pendingTransaction = pendingTransactionDbResults[0];

      const failedTransactionDbInsert: FailedPaymentTransactionDBInsert = {
        ...pendingTransaction,
        failed_reason: failedReason,
      };

      await knexTransaction<FailedPaymentTransactionDBResult>(
        tableNames.failedPaymentTransaction
      ).insert(failedTransactionDbInsert);
    });
  }

  public async checkForPendingTransaction(
    transactionId: TransactionId
  ): Promise<
    | PendingPaymentTransaction
    | FailedPaymentTransaction
    | CreditedPaymentTransaction
    | false
  > {
    const tables = [
      tableNames.pendingPaymentTransaction,
      tableNames.failedPaymentTransaction,
      tableNames.creditedPaymentTransaction,
    ];

    return this.reader.transaction(async (knexTransaction) => {
      try {
        const result = await Promise.any<
          | PendingPaymentTransactionDBResult
          | FailedPaymentTransactionDBResult
          | CreditedPaymentTransactionDBResult
        >(
          tables.map(async (tableName) => {
            const res = await knexTransaction(tableName)
              .where({
                transaction_id: transactionId,
              })
              .first();
            return res || Promise.reject(new Error("No results found"));
          })
        );

        if (isFailedPaymentTransactionDBResult(result)) {
          return failedTransactionDBMap(result);
        }
        if (isCreditedPaymentTransactionDBResult(result)) {
          return creditedTransactionDBMap(result);
        }
        return pendingPaymentTransactionDBMap(result);
      } catch (error) {
        if (error instanceof AggregateError) {
          return false;
        }
        throw error;
      }
    });
  }

  public async getPendingTransactions(): Promise<PendingPaymentTransaction[]> {
    const dbResults = await this.reader<PendingPaymentTransactionDBResult>(
      tableNames.pendingPaymentTransaction
    );
    return dbResults.map(pendingPaymentTransactionDBMap);
  }

  private async creditOrCreateUser({
    changeId,
    changeReason,
    knexTransaction,
    userAddress,
    userAddressType,
    winstonCreditAmount,
  }: {
    userAddress: string;
    userAddressType: UserAddressType;
    changeReason: "payment" | "gifted_payment" | "crypto_payment";
    changeId: string;
    winstonCreditAmount: Winston;
    knexTransaction: KnexTransaction;
  }): Promise<void> {
    try {
      const user = await this.getUser(userAddress, knexTransaction);
      const currentBalance = user.winstonCreditBalance;
      const newBalance = currentBalance.plus(winstonCreditAmount);

      this.log.debug("Incrementing balance...", {
        userAddress,
        currentBalance,
        newBalance,
      });

      await knexTransaction<UserDBResult>(tableNames.user)
        .where({
          user_address: userAddress,
        })
        .update({ winston_credit_balance: newBalance.toString() });

      const auditLogInsert: AuditLogInsert = {
        user_address: userAddress,
        winston_credit_amount: winstonCreditAmount.toString(),
        change_reason: changeReason,
        change_id: changeId,
      };
      await knexTransaction(tableNames.auditLog).insert(auditLogInsert);
    } catch (error) {
      if (error instanceof UserNotFoundWarning) {
        this.log.debug(
          `No user found with address '${userAddress}'. Creating a new user with balance of credited winc amount.`
        );
        const userDbInsert: UserDBInsert = {
          user_address: userAddress,
          user_address_type: userAddressType,
          winston_credit_balance: winstonCreditAmount.toString(),
        };
        await knexTransaction<UserDBResult>(tableNames.user).insert(
          userDbInsert
        );
        const auditLogInsert: AuditLogInsert = {
          user_address: userAddress,
          winston_credit_amount: winstonCreditAmount.toString(),
          change_reason:
            changeReason === "payment"
              ? "account_creation"
              : "gifted_account_creation",
          change_id: changeId,
        };
        await knexTransaction(tableNames.auditLog).insert(auditLogInsert);
      } else {
        throw error;
      }
    }
  }

  public async createNewCreditedTransaction(
    params: CreateNewCreditedTransactionParams
  ): Promise<void> {
    this.log.debug("Inserting new credited transaction...", {
      params,
    });

    const {
      destinationAddress,
      winstonCreditAmount,
      adjustments,
      destinationAddressType,
      transactionId,
      transactionQuantity,
      tokenType,
      blockHeight,
    } = params;

    await this.writer.transaction(async (knexTransaction) => {
      const creditedTransactionDbInsert: CreditedPaymentTransactionDBInsert = {
        destination_address: destinationAddress,
        winston_credit_amount: winstonCreditAmount.toString(),
        destination_address_type: destinationAddressType,
        transaction_id: transactionId,
        transaction_quantity: transactionQuantity.toString(),
        token_type: tokenType,
        block_height: blockHeight,
      };

      await knexTransaction<CreditedPaymentTransactionDBResult>(
        tableNames.creditedPaymentTransaction
      ).insert(creditedTransactionDbInsert);

      await knexTransaction.batchInsert(
        tableNames.paymentAdjustment,
        adjustments.map(
          ({ adjustmentAmount, catalogId, currencyType }, index) => {
            const adjustmentDbInsert: PaymentAdjustmentDBInsert = {
              adjusted_payment_amount: adjustmentAmount.toString(),
              adjusted_currency_type: currencyType,
              user_address: destinationAddress,
              catalog_id: catalogId,
              adjustment_index: index,
              top_up_quote_id: transactionId,
            };
            return adjustmentDbInsert;
          }
        )
      );

      await this.creditOrCreateUser({
        userAddress: destinationAddress,
        userAddressType: tokenType,
        changeReason: "crypto_payment",
        changeId: transactionId,
        winstonCreditAmount,
        knexTransaction,
      });
    });
  }

  public async getWincUsedForUploadAdjustmentCatalog({
    userAddress,
    catalogId,
    limitationInterval,
    limitationIntervalUnit,
  }: WincUsedForUploadAdjustmentParams): Promise<WC> {
    const uploadAdjustmentDbResult =
      await this.reader<UploadAdjustmentDBResult>(
        tableNames.uploadAdjustment
      ).where({ catalog_id: catalogId, user_address: userAddress })
        .andWhereRaw(`
        ${columnNames.adjustmentDate} > NOW() - interval '${limitationInterval} ${limitationIntervalUnit}'
      `);

    return uploadAdjustmentDbResult.reduce(
      (acc, { adjusted_winc_amount }) => acc.plus(W(adjusted_winc_amount)),
      W(0)
    );
  }

  private async getLockedUser(
    userAddress: string,
    knexTransaction: KnexTransaction
  ): Promise<User> {
    const user = await knexTransaction<UserDBResult>(tableNames.user)
      .where({
        user_address: userAddress,
      })
      .forUpdate()
      .first();

    if (!user) {
      throw new UserNotFoundWarning(userAddress);
    }

    return userDBMap(user);
  }

  public async createDelegatedPaymentApproval({
    approvalDataItemId,
    approvedAddress,
    approvedWincAmount,
    payingAddress,
    expiresInSeconds,
  }: CreateDelegatedPaymentApprovalParams): Promise<DelegatedPaymentApproval> {
    return this.writer.transaction(async (knexTransaction) => {
      const conflictingApprovals = await Promise.all([
        knexTransaction<DelegatedPaymentApprovalDBResult>(
          tableNames.delegatedPaymentApproval
        ).where({
          approval_data_item_id: approvalDataItemId,
        }),
        knexTransaction<InactiveDelegatedPaymentApprovalDBResult>(
          tableNames.inactiveDelegatedPaymentApproval
        ).where({
          approval_data_item_id: approvalDataItemId,
        }),
      ]);
      if (conflictingApprovals.some((approvals) => approvals.length > 0)) {
        throw new ConflictingApprovalFound(approvalDataItemId);
      }

      const user = await this.getLockedUser(payingAddress, knexTransaction);
      if (user.winstonCreditBalance.isLessThan(approvedWincAmount)) {
        throw new InsufficientBalance(payingAddress);
      }

      const delegatedPaymentApprovalDbInsert: DelegatedPaymentApprovalDBInsert =
        {
          approval_data_item_id: approvalDataItemId,
          approved_address: approvedAddress,
          approved_winc_amount: approvedWincAmount.toString(),
          paying_address: payingAddress,
          expiration_date:
            expiresInSeconds === undefined
              ? undefined
              : new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
        };

      const approvalDbResult =
        await knexTransaction<DelegatedPaymentApprovalDBResult>(
          tableNames.delegatedPaymentApproval
        )
          .insert(delegatedPaymentApprovalDbInsert)
          .returning("*");

      const newBalance = user.winstonCreditBalance.minus(approvedWincAmount);
      await knexTransaction<UserDBResult>(tableNames.user)
        .where({
          user_address: payingAddress,
        })
        .update({ winston_credit_balance: newBalance.toString() });

      const auditLogInsert: AuditLogInsert = {
        user_address: payingAddress,
        winston_credit_amount: `-${approvedWincAmount.toString()}`, // negative value because this amount was withdrawn from the users balance
        change_reason: "delegated_payment_approval",
        change_id: approvalDataItemId,
      };
      await knexTransaction(tableNames.auditLog).insert(auditLogInsert);

      return delegatedPaymentApprovalDBMap(approvalDbResult[0]);
    });
  }

  public async revokeDelegatedPaymentApprovals({
    approvedAddress,
    payingAddress,
    revokeDataItemId,
  }: {
    payingAddress: UserAddress;
    approvedAddress: UserAddress;
    revokeDataItemId: DataItemId;
  }): Promise<InactiveDelegatedPaymentApproval[]> {
    return this.writer.transaction(async (knexTransaction) => {
      // TODO: Consider revokes and reserve balance happening at the same time
      const deletedActiveApprovals =
        await knexTransaction<DelegatedPaymentApprovalDBResult>(
          tableNames.delegatedPaymentApproval
        )
          .where({
            approved_address: approvedAddress,
            paying_address: payingAddress,
          })
          .delete()
          .returning("*");

      const newInactiveApprovals: InactiveDelegatedPaymentApprovalDBResult[] =
        [];
      if (deletedActiveApprovals.length > 0) {
        const newInactiveApprovalInserts: InactiveDelegatedPaymentApprovalDBInsert[] =
          deletedActiveApprovals.map((a) => ({
            ...a,
            inactive_reason: "revoked",
            revoke_data_item_id: revokeDataItemId,
          }));

        newInactiveApprovals.push(
          ...(await knexTransaction
            .batchInsert<InactiveDelegatedPaymentApprovalDBResult>(
              tableNames.inactiveDelegatedPaymentApproval,
              newInactiveApprovalInserts
            )
            .returning("*"))
        );

        const approvedAmount = newInactiveApprovals
          .map((a) => W(a.approved_winc_amount))
          .reduce((a, b) => a.plus(b), W(0));
        const usedAmount = newInactiveApprovals
          .map((a) => W(a.used_winc_amount))
          .reduce((a, b) => a.plus(b), W(0));
        const wincToRefund = approvedAmount.minus(usedAmount);

        const user = await this.getLockedUser(payingAddress, knexTransaction);
        const newBalance = user.winstonCreditBalance.plus(wincToRefund);

        await knexTransaction<UserDBResult>(tableNames.user)
          .where({
            user_address: payingAddress,
          })
          .update({ winston_credit_balance: newBalance.toString() });

        const auditLogInsert: AuditLogInsert = {
          user_address: payingAddress,
          winston_credit_amount: wincToRefund.toString(),
          change_reason: "delegated_payment_revoke",
          change_id: revokeDataItemId,
        };
        await knexTransaction(tableNames.auditLog).insert(auditLogInsert);
      }

      // When paying user send a revoke action, set all used approvals to revoked
      // so that if they are refunded the balance returns to paying user
      const existingUsedApprovalsMovedToRevoked =
        await knexTransaction<InactiveDelegatedPaymentApprovalDBResult>(
          tableNames.inactiveDelegatedPaymentApproval
        )
          .where({
            approved_address: approvedAddress,
            paying_address: payingAddress,
            inactive_reason: "used",
          })
          .update({
            inactive_reason: "revoked",
            revoke_data_item_id: revokeDataItemId,
          })
          .returning("*");

      const returnedApprovals = [
        ...newInactiveApprovals,
        ...existingUsedApprovalsMovedToRevoked,
      ];
      if (returnedApprovals.length === 0) {
        throw new NoApprovalsFound({ approvedAddress, payingAddress });
      }

      return returnedApprovals.map(inactiveDelegatedPaymentApprovalDBMap);
    });
  }

  public async getAllApprovalsForUserAddress(
    userAddress: UserAddress,
    knexTransaction: KnexTransaction = this.reader
  ): Promise<{
    givenApprovals: DelegatedPaymentApproval[];
    receivedApprovals: DelegatedPaymentApproval[];
  }> {
    const dbResults = await knexTransaction<DelegatedPaymentApprovalDBResult>(
      tableNames.delegatedPaymentApproval
    )
      .where({
        approved_address: userAddress,
      })
      .or.where({
        paying_address: userAddress,
      })
      .orderBy(this.delegatedPaymentSort());

    const trimmedResults = await this.trimExpiredApprovals(dbResults);

    const givenApprovals: DelegatedPaymentApproval[] = [];
    const receivedApprovals: DelegatedPaymentApproval[] = [];

    trimmedResults.forEach((approval) => {
      if (approval.paying_address === userAddress) {
        givenApprovals.push(delegatedPaymentApprovalDBMap(approval));
      }
      if (approval.approved_address === userAddress) {
        receivedApprovals.push(delegatedPaymentApprovalDBMap(approval));
      }
    });

    return { givenApprovals, receivedApprovals };
  }

  public async getApprovalsFromPayerForAddress(
    {
      approvedAddress,
      payingAddress,
    }: { payingAddress: UserAddress; approvedAddress: UserAddress },
    knexTransaction = this.reader
  ): Promise<DelegatedPaymentApproval[]> {
    const dbResults = await knexTransaction<DelegatedPaymentApprovalDBResult>(
      tableNames.delegatedPaymentApproval
    ).where({
      paying_address: payingAddress,
      approved_address: approvedAddress,
    });

    const trimmedResults = await this.trimExpiredApprovals(dbResults);

    if (trimmedResults.length === 0) {
      throw new NoApprovalsFound({ approvedAddress, payingAddress });
    }

    return trimmedResults.map(delegatedPaymentApprovalDBMap);
  }

  // always sort by:
  // - if expiration_date exists, sort by expiration_date, the one closest to expiring is first
  // - if expiration_date does not exist, sort by creation_date, the oldest one is first
  // - when expiration_date exists, it is always before ones that have expiration_date of null
  private delegatedPaymentSort() {
    return [
      { column: "expiration_date", order: "asc" },
      { column: "creation_date", order: "asc" },
    ];
  }

  private async trimExpiredApprovals(
    approvals: DelegatedPaymentApprovalDBResult[],
    knexTransaction: KnexTransaction = this.writer
  ): Promise<DelegatedPaymentApprovalDBResult[]> {
    const expiredApprovals: DelegatedPaymentApprovalDBResult[] = [];
    const trimmedApprovals: DelegatedPaymentApprovalDBResult[] = [];

    const now = new Date();

    for (const approval of approvals) {
      const { approval_data_item_id, expiration_date } = approval;
      if (!expiration_date || new Date(expiration_date) > now) {
        trimmedApprovals.push(approval);
        continue; // exit early when approval is not expired
      }

      const deletedApproval = (
        await knexTransaction<DelegatedPaymentApprovalDBResult>(
          tableNames.delegatedPaymentApproval
        )
          .where({
            approval_data_item_id,
          })
          .delete()
          .returning("*")
      )[0];
      if (deletedApproval) {
        // If we deleted one, we need to insert it into the inactive table
        // Otherwise we may have encountered a race condition where another process deleted it
        const inactiveApprovalInsert: InactiveDelegatedPaymentApprovalDBInsert =
          {
            ...deletedApproval,
            inactive_reason: "expired",
          };
        await knexTransaction(
          tableNames.inactiveDelegatedPaymentApproval
        ).insert(inactiveApprovalInsert);
      }

      // Push into expired approvals whether we deleted it or not
      expiredApprovals.push(approval);
    }

    if (expiredApprovals.length > 0) {
      this.log.info("Trimmed expired approvals", {
        expiredApprovals,
        trimmedApprovals,
      });

      // sort into tuples by paying address
      const sortedApprovals = expiredApprovals.reduce((acc, approval) => {
        const payingAddress = approval.paying_address;
        if (!acc[payingAddress]) {
          acc[payingAddress] = [];
        }
        acc[payingAddress].push(approval);
        return acc;
      }, {} as Record<UserAddress, DelegatedPaymentApprovalDBResult[]>);

      for (const expiredApprovals of Object.values(sortedApprovals)) {
        const paying_address = expiredApprovals[0].paying_address;
        const usedWincAmount = expiredApprovals.reduce(
          (acc, approval) => acc.plus(W(approval.used_winc_amount)),
          W(0)
        );
        const approvedWincAmount = expiredApprovals.reduce(
          (acc, approval) => acc.plus(W(approval.approved_winc_amount)),
          W(0)
        );
        const wincToRefund = approvedWincAmount.minus(usedWincAmount);

        const user = await this.getLockedUser(paying_address, knexTransaction);
        const newBalance = user.winstonCreditBalance.plus(wincToRefund);

        await knexTransaction<UserDBResult>(tableNames.user)
          .where({
            user_address: paying_address,
          })
          .update({ winston_credit_balance: newBalance.toString() });

        const auditLogInsert: AuditLogInsert = {
          user_address: paying_address,
          winston_credit_amount: wincToRefund.toString(),
          change_reason: "delegated_payment_expired",
        };
        await knexTransaction(tableNames.auditLog).insert(auditLogInsert);
      }
    }
    return trimmedApprovals;
  }

  private safeGetApprovalsFromPayerForAddress(
    params: {
      approvedAddress: UserAddress;
      payingAddress: UserAddress;
    },
    knexTransaction: KnexTransaction
  ): Promise<DelegatedPaymentApproval[]> {
    return this.getApprovalsFromPayerForAddress(params, knexTransaction).catch(
      (error) => {
        if (error instanceof NoApprovalsFound) {
          return [];
        }
        throw error;
      }
    );
  }

  public async createArNSPurchaseReceipt({
    nonce,
    mARIOQty,
    name,
    owner,
    type,
    wincQty,
    processId,
    years,
    intent,
    increaseQty,
    usdArRate,
    usdArioRate,
    paidBy,
  }: ArNSPurchaseParams): Promise<ArNSPurchase> {
    return this.writer.transaction(async (knexTransaction) => {
      const overflow_spend = await this.useBalanceAndApprovals({
        changeId: nonce,
        changeReason: "arns_purchase_order",
        knexTransaction,
        paidBy,
        signerAddress: owner,
        wincAmount: wincQty,
      });

      const pendingArNSPurchaseDbInsert: ArNSPurchaseDBInsert = {
        nonce,
        mario_qty: mARIOQty.toString(),
        intent,
        increase_qty: increaseQty,
        name,
        owner,
        type,
        winc_qty: wincQty.toString(),
        process_id: processId,
        years,
        usd_ar_rate: usdArRate,
        usd_ario_rate: usdArioRate,
        overflow_spend: JSON.stringify(overflow_spend),
        paid_by: paidBy.length > 0 ? paidBy.join(",") : undefined,
      };
      let receipt: ArNSPurchaseDBResult[];
      try {
        receipt = await knexTransaction<ArNSPurchaseDBResult>(
          tableNames.arNSPurchaseReceipt
        )
          .insert(pendingArNSPurchaseDbInsert)
          .returning("*");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("arns_purchase_receipt_pkey")) {
          throw new ArNSPurchaseAlreadyExists(name, nonce);
        }
        throw e;
      }

      return arnsPurchaseReceiptDBMap(receipt[0]);
    });
  }

  public async updateFailedArNSPurchase(
    nonce: string,
    failedReason: string
  ): Promise<void> {
    await this.writer.transaction(async (knexTransaction) => {
      const pendingArNSPurchaseDbResult =
        await knexTransaction<ArNSPurchaseDBResult>(
          tableNames.arNSPurchaseReceipt
        )
          .where({
            nonce: nonce,
          })
          .del()
          .returning("*");

      if (pendingArNSPurchaseDbResult.length === 0) {
        throw new ArNSPurchaseNotFound(nonce);
      }

      await this.refundWincFromOverflowSpend({
        overflowSpend: pendingArNSPurchaseDbResult[0]
          .overflow_spend as unknown as OverflowSpendDBResult,
        signerAddress: pendingArNSPurchaseDbResult[0].owner,
        wincAmount: W(pendingArNSPurchaseDbResult[0].winc_qty),
        knexTransaction,
        changeId: nonce,
        changeReason: "arns_purchase_order_failed",
      });

      const dbInsert: FailedArNSPurchaseDBInsert = {
        ...pendingArNSPurchaseDbResult[0],
        failed_reason: failedReason,
        overflow_spend: pendingArNSPurchaseDbResult[0].overflow_spend
          ? JSON.stringify(pendingArNSPurchaseDbResult[0].overflow_spend)
          : undefined,
      };

      await knexTransaction(tableNames.failedArNSPurchase).insert(dbInsert);
    });
  }

  public async getArNSPurchaseStatus(
    nonce: string,
    knexTransaction: KnexTransaction = this.reader
  ): Promise<ArNSPurchaseStatusResult | undefined> {
    const tables = [
      tableNames.arNSPurchaseReceipt,
      tableNames.failedArNSPurchase,
      tableNames.arNSPurchaseQuote,
    ];

    try {
      const result = await Promise.any<
        | ArNSPurchaseDBResult
        | FailedArNSPurchaseDBResult
        | ArNSPurchaseQuoteDBResult
      >(
        tables.map(async (tableName) => {
          const res = await knexTransaction(tableName).where({ nonce }).first();

          return res || Promise.reject(new Error("No results found"));
        })
      );

      return arnsPurchaseDBMap(result);
    } catch (error) {
      if (error instanceof AggregateError) {
        return undefined;
      }
      throw error;
    }
  }

  public async createArNSPurchaseQuote(
    params: ArNSPurchaseQuoteParams
  ): Promise<ArNSPurchaseQuote> {
    return this.writer.transaction(async (knexTransaction) => {
      const receipt = await knexTransaction<ArNSPurchaseQuoteDBResult>(
        tableNames.arNSPurchaseQuote
      )
        .insert(arnsPurchaseQuoteDBInsertFromParams(params))
        .returning("*");

      const { adjustments, nonce, owner, currencyType } = params;
      await knexTransaction.batchInsert(
        tableNames.paymentAdjustment,
        adjustments.map(({ adjustmentAmount, catalogId }, index) => {
          const adjustmentDbInsert: PaymentAdjustmentDBInsert = {
            adjusted_payment_amount: adjustmentAmount.toString(),
            adjusted_currency_type: currencyType,
            user_address: owner,
            catalog_id: catalogId,
            adjustment_index: index,
            top_up_quote_id: nonce,
          };
          return adjustmentDbInsert;
        })
      );

      return arnsPurchaseQuoteDBMap(receipt[0]);
    });
  }

  public async addMessageIdToPurchaseReceipt({
    messageId,
    nonce,
  }: {
    nonce: string;
    messageId: string;
  }): Promise<void> {
    return this.writer<ArNSPurchaseDBResult>(tableNames.arNSPurchaseReceipt)
      .where({ nonce })
      .update({ message_id: messageId });
  }

  public async getArNSPurchaseQuote(
    nonce: string
  ): Promise<{ quote: ArNSPurchaseQuote }> {
    const result = await this.reader<ArNSPurchaseQuoteDBResult>(
      tableNames.arNSPurchaseQuote
    )
      .where({ nonce })
      .first();

    if (!result) {
      throw new ArNSPurchaseNotFound(nonce);
    }

    return { quote: arnsPurchaseQuoteDBMap(result) };
  }

  public async updateArNSPurchaseQuoteToFailure(
    nonce: string,
    failedReason: string
  ): Promise<void> {
    return this.writer.transaction(async (knexTransaction) => {
      const pendingArNSPurchaseDbResult =
        await knexTransaction<ArNSPurchaseQuoteDBResult>(
          tableNames.arNSPurchaseQuote
        )
          .where({
            nonce: nonce,
          })
          .del()
          .returning("*");

      if (pendingArNSPurchaseDbResult.length === 0) {
        throw new ArNSPurchaseNotFound(nonce);
      }

      const dbInsert: FailedArNSPurchaseDBInsert = {
        ...pendingArNSPurchaseDbResult[0],
        failed_reason: failedReason,
      };

      await knexTransaction(tableNames.failedArNSPurchase).insert(dbInsert);
    });
  }

  public async updateArNSPurchaseQuoteToSuccess({
    nonce,
    messageId,
  }: {
    nonce: string;
    messageId: string;
  }): Promise<void> {
    return this.writer.transaction(async (knexTransaction) => {
      const pendingArNSPurchaseDbResult =
        await knexTransaction<ArNSPurchaseQuoteDBResult>(
          tableNames.arNSPurchaseQuote
        )
          .where({
            nonce,
          })
          .del()
          .returning("*");

      if (pendingArNSPurchaseDbResult.length === 0) {
        throw new ArNSPurchaseNotFound(nonce);
      }
      const { quote_expiration_date, excess_winc } =
        pendingArNSPurchaseDbResult[0];
      if (new Date(quote_expiration_date).getTime() < new Date().getTime()) {
        await this.updateArNSPurchaseQuoteToFailure(nonce, "expired");

        throw Error(
          `Quote with nonce ${nonce} has expired. Quote expiration date: ${quote_expiration_date}`
        );
      }

      const userAddress = pendingArNSPurchaseDbResult[0].owner;
      if (excess_winc && excess_winc !== "0") {
        if (+excess_winc < 0) {
          throw new Error(
            `Excess winc cannot be negative. Received: ${excess_winc}`
          );
        }

        // Credit the excess winc from the purchase to the user
        const user = await knexTransaction<UserDBResult>(tableNames.user)
          .where({
            user_address: userAddress,
          })
          .forUpdate()
          .first();

        if (user === undefined) {
          // Create a new user with the excess winc
          const userDbInsert: UserDBInsert = {
            user_address: userAddress,
            user_address_type: "user",
            winston_credit_balance: excess_winc.toString(),
          };
          await knexTransaction<UserDBResult>(tableNames.user).insert(
            userDbInsert
          );
          const auditLogInsert: AuditLogInsert = {
            user_address: userAddress,
            winston_credit_amount: excess_winc.toString(),
            change_reason: "arns_account_creation",
            change_id: nonce,
          };
          await knexTransaction(tableNames.auditLog).insert(auditLogInsert);
        } else {
          // Update the existing user with the excess winc
          const newBalance = W(user.winston_credit_balance).plus(
            W(excess_winc)
          );
          await knexTransaction<UserDBResult>(tableNames.user)
            .where({ user_address: userAddress })
            .update({ winston_credit_balance: newBalance.toString() });
          const auditLogInsert: AuditLogInsert = {
            user_address: userAddress,
            winston_credit_amount: excess_winc.toString(),
            change_reason: "arns_purchase_order",
            change_id: nonce,
          };
          await knexTransaction(tableNames.auditLog).insert(auditLogInsert);
        }
      } else {
        // Add audit log with 0 credit change to register the payment for arns interaction
        const auditLogInsert: AuditLogInsert = {
          user_address: userAddress,
          winston_credit_amount: "0",
          change_reason: "arns_purchase_order",
          change_id: nonce,
        };
        await knexTransaction(tableNames.auditLog).insert(auditLogInsert);
      }

      const dbInsert: ArNSPurchaseDBInsert = {
        ...pendingArNSPurchaseDbResult[0],
        message_id: messageId,
      };

      await knexTransaction<ArNSPurchaseDBResult>(
        tableNames.arNSPurchaseReceipt
      ).insert(dbInsert);
    });
  }

  private async useBalanceAndApprovals({
    wincAmount,
    changeId,
    changeReason,
    paidBy,
    signerAddress,
    knexTransaction,
    paymentDirective = "list-or-signer",
  }: {
    signerAddress: string;
    wincAmount: WC;
    paidBy: UserAddress[];
    changeId: string;
    changeReason: "upload" | "arns_purchase_order";
    knexTransaction: KnexTransaction;
    paymentDirective?: PaymentDirective;
  }): Promise<OverflowSpendDBResult | undefined> {
    // Dedupe paidBy array
    paidBy = [...new Set(paidBy)];

    // Locks the signing user row and all received approvals
    const signer = await knexTransaction<UserDBResult>(tableNames.user)
      .forUpdate()
      .where({
        user_address: signerAddress,
      })
      .first();
    const signerBalance = W(signer?.winston_credit_balance ?? 0);

    const pendingSpend: {
      payingAddress: UserAddress;
      wincAmount: WC;
      delegatedApprovals: DelegatedPaymentApproval[];
    }[] = [];

    if (paidBy.length === 0) {
      // Always use the signing user to reserve winc when no payers are specified
      pendingSpend.push({
        payingAddress: signerAddress,
        wincAmount,
        delegatedApprovals: [],
      });
    } else {
      // Lock all received approvals when signer provides paid-by addresses
      const receivedApprovals = (
        await knexTransaction<DelegatedPaymentApprovalDBResult>(
          tableNames.delegatedPaymentApproval
        )
          .where({
            approved_address: signerAddress,
          })
          .forUpdate()
      ).map(delegatedPaymentApprovalDBMap);

      let remainingWincAmount = wincAmount;
      let signerProvidedAsPaidBy = false;

      for (const payingAddress of paidBy) {
        if (remainingWincAmount.isZero()) {
          break;
        }

        if (payingAddress === signerAddress) {
          // If signer is provided as a payer, use the signer's balance without needing an approval
          // Cover the whole remainder if signer has enough balance, else continue to the next payer

          const signerSpendAmount = signerBalance.isGreaterThanOrEqualTo(
            remainingWincAmount
          )
            ? remainingWincAmount
            : signerBalance;

          remainingWincAmount = remainingWincAmount.minus(signerSpendAmount);

          if (!signerSpendAmount.isZero()) {
            pendingSpend.push({
              payingAddress: signerAddress,
              wincAmount: signerSpendAmount,
              delegatedApprovals: [],
            });
            signerProvidedAsPaidBy = true;
          }

          continue;
        }

        const approvalsFromPayer = receivedApprovals.filter(
          (approval) => approval.payingAddress === payingAddress
        );

        if (approvalsFromPayer.length === 0) {
          // If no approvals are found for the payer, skip to the next payer
          // Client may have out of date info about approvals, no need to throw an error
          continue;
        }

        const approvedWincFromPayer =
          remainingWincAmountFromApprovals(approvalsFromPayer);
        const allocatedSpendAmount =
          approvedWincFromPayer.isGreaterThanOrEqualTo(remainingWincAmount)
            ? remainingWincAmount
            : approvedWincFromPayer;

        remainingWincAmount = remainingWincAmount.minus(allocatedSpendAmount);

        if (!allocatedSpendAmount.isZero()) {
          pendingSpend.push({
            payingAddress,
            wincAmount: allocatedSpendAmount,
            delegatedApprovals: approvalsFromPayer,
          });
        }
      }

      // If there is still remaining winc after payers have been exhausted,
      // check if the signer's balance can cover the remaining amount
      if (
        remainingWincAmount.isNonZeroPositiveInteger() &&
        paymentDirective !== "list-only" && // Opt out of using the user's balance in overflow if the directive is list-only
        !signerProvidedAsPaidBy // Skip if the signer was already provided as a payer
      ) {
        if (signerBalance.isGreaterThanOrEqualTo(remainingWincAmount)) {
          // When enough balance, use the signing user as the last overflow spender
          pendingSpend.push({
            payingAddress: signerAddress,
            wincAmount: remainingWincAmount,
            delegatedApprovals: [],
          });
          remainingWincAmount = W(0);
        }
      }

      if (remainingWincAmount.isNonZeroPositiveInteger()) {
        // If there is still remaining winc after all payers have been exhausted, throw an insufficient balance error
        throw new InsufficientBalance(signerAddress);
      }
    }

    // If payers are only one, and it is the signer, do not store the overflow spend
    // If payers are more than one, store the overflow spend
    // If payer is not the signer, store the overflow spend
    const overflowSpend =
      pendingSpend.length > 1 || pendingSpend[0].payingAddress !== signerAddress
        ? pendingSpend.map(({ payingAddress, wincAmount }) => ({
            paying_address: payingAddress,
            winc_amount: wincAmount.toString(),
          }))
        : undefined;

    if (wincAmount.isLessThan(W(1))) {
      return overflowSpend;
    }

    for (const {
      payingAddress,
      wincAmount,
      delegatedApprovals,
    } of pendingSpend) {
      if (payingAddress !== signerAddress) {
        let remainingWincToCreditToApprovals = wincAmount;

        // Increment used_winc_amount on each approval, marking to "used" if the entire approval was used
        for (const {
          approvedWincAmount,
          usedWincAmount,
          approvalDataItemId,
        } of delegatedApprovals) {
          if (remainingWincToCreditToApprovals.isLessThan(W(1))) {
            break;
          }

          const remainingApprovalAmount =
            approvedWincAmount.minus(usedWincAmount);
          const wincAmountToSpend =
            remainingApprovalAmount.isGreaterThanOrEqualTo(
              remainingWincToCreditToApprovals
            )
              ? remainingWincToCreditToApprovals
              : remainingApprovalAmount;

          remainingWincToCreditToApprovals =
            remainingWincToCreditToApprovals.minus(wincAmountToSpend);

          const newUsedWincAmount = usedWincAmount.plus(wincAmountToSpend);

          if (newUsedWincAmount.isEqualTo(approvedWincAmount)) {
            // Move the approval to used if the entire approval was used
            const approval =
              await knexTransaction<DelegatedPaymentApprovalDBResult>(
                tableNames.delegatedPaymentApproval
              )
                .where({
                  approval_data_item_id: approvalDataItemId,
                })
                .del()
                .returning("*");
            const inactiveApprovalDbInsert: InactiveDelegatedPaymentApprovalDBInsert =
              {
                ...approval[0],
                used_winc_amount: newUsedWincAmount.toString(),
                inactive_reason: "used",
              };
            await knexTransaction<InactiveDelegatedPaymentApprovalDBResult>(
              tableNames.inactiveDelegatedPaymentApproval
            ).insert(inactiveApprovalDbInsert);
          } else {
            await knexTransaction<DelegatedPaymentApprovalDBResult>(
              tableNames.delegatedPaymentApproval
            )
              .where({
                approval_data_item_id: approvalDataItemId,
              })
              .update({
                used_winc_amount: newUsedWincAmount.toString(),
              });
          }
        }

        if (remainingWincToCreditToApprovals.isNonZeroPositiveInteger()) {
          this.log.error(
            "Remaining winc amount after crediting approvals. Approver did not have enough remaining approved winc to cover winc to spend",
            {
              payingAddress,
              remainingWincToCreditToApprovals,
            }
          );
          throw new InsufficientBalance(payingAddress);
        }

        const auditLogInsert: AuditLogInsert = {
          user_address: payingAddress,
          winston_credit_amount: `-${wincAmount.toString()}`, // a negative value because this amount was withdrawn from the users balance
          change_reason: `approved_${changeReason}`,
          change_id: changeId,
        };
        await knexTransaction(tableNames.auditLog).insert(auditLogInsert);
      } else {
        // For signer, decrement their balance
        const newBalance = signerBalance.minus(wincAmount);

        if (newBalance.isNonZeroNegativeInteger()) {
          throw new InsufficientBalance(payingAddress);
        }

        await knexTransaction<UserDBResult>(tableNames.user)
          .where({
            user_address: payingAddress,
          })
          .update({ winston_credit_balance: newBalance.toString() });

        const auditLogInsert: AuditLogInsert = {
          user_address: payingAddress,
          winston_credit_amount: `-${wincAmount.toString()}`, // a negative value because this amount was withdrawn from the users balance
          change_reason: changeReason,
          change_id: changeId,
        };
        await knexTransaction(tableNames.auditLog).insert(auditLogInsert);
      }
    }
    return overflowSpend;
  }

  private async refundWincFromOverflowSpend({
    knexTransaction,
    overflowSpend,
    signerAddress,
    wincAmount,
    changeId,
    changeReason,
  }: {
    overflowSpend: OverflowSpendDBResult | undefined;
    signerAddress: UserAddress;
    wincAmount: WC;
    knexTransaction: KnexTransaction;
    changeId: string;
    changeReason: AuditChangeReason;
  }): Promise<void> {
    const payers: PendingSpend[] = [];

    if (!overflowSpend) {
      payers.push({
        paying_address: signerAddress,
        winc_amount: wincAmount,
      });
    } else {
      for (const {
        paying_address,
        winc_amount,
      } of overflowSpend as unknown as OverflowSpendDBResult) {
        payers.push({
          paying_address,
          winc_amount: W(winc_amount),
        });
      }
    }

    for (const { paying_address, winc_amount } of payers) {
      if (paying_address !== signerAddress) {
        let remainingWincToRefundToApprovals = winc_amount;
        const approvalsFromPayer =
          await this.safeGetApprovalsFromPayerForAddress(
            {
              approvedAddress: signerAddress,
              payingAddress: paying_address,
            },
            knexTransaction
          );
        for (const {
          approvalDataItemId,
          usedWincAmount,
        } of approvalsFromPayer) {
          if (remainingWincToRefundToApprovals.isLessThan(W(1))) {
            break;
          }

          if (usedWincAmount.isGreaterThanOrEqualTo(winc_amount)) {
            const newUsedWincAmount = usedWincAmount.minus(winc_amount);
            await knexTransaction<DelegatedPaymentApprovalDBResult>(
              tableNames.delegatedPaymentApproval
            )
              .where({
                approval_data_item_id: approvalDataItemId,
              })
              .update({
                used_winc_amount: newUsedWincAmount.toString(),
              });
            remainingWincToRefundToApprovals = W(0);
          } else {
            const newUsedWincAmount = W(0);
            await knexTransaction<DelegatedPaymentApprovalDBResult>(
              tableNames.delegatedPaymentApproval
            )
              .where({
                approval_data_item_id: approvalDataItemId,
              })
              .update({
                used_winc_amount: newUsedWincAmount.toString(),
              });
            remainingWincToRefundToApprovals =
              remainingWincToRefundToApprovals.minus(usedWincAmount);
          }
        }

        // Handle refunding any inactive approvals
        const inactiveApprovalsFromPayer =
          await knexTransaction<InactiveDelegatedPaymentApprovalDBResult>(
            tableNames.inactiveDelegatedPaymentApproval
          ).where({
            approved_address: signerAddress,
            paying_address: paying_address,
          });
        for (const {
          approval_data_item_id,
          used_winc_amount,
          inactive_reason,
          paying_address,
        } of inactiveApprovalsFromPayer) {
          if (remainingWincToRefundToApprovals.isLessThan(W(1))) {
            break;
          }
          if (inactive_reason === "expired" || inactive_reason === "revoked") {
            // Refund the balance to the paying address when the approval is expired or revoked
            const payer = await this.getLockedUser(
              paying_address,
              knexTransaction
            );
            const newBalance = payer.winstonCreditBalance.plus(
              W(used_winc_amount)
            );
            await knexTransaction<UserDBResult>(tableNames.user)
              .where({
                user_address: paying_address,
              })
              .update({ winston_credit_balance: newBalance.toString() });
            const auditLogInsert: AuditLogInsert = {
              user_address: paying_address,
              winston_credit_amount: used_winc_amount,
              change_reason: `delegated_payment_${
                inactive_reason === "expired" ? "expired" : "revoke"
              }`,
              change_id: changeId,
            };
            await knexTransaction(tableNames.auditLog).insert(auditLogInsert);

            continue;
          }
          const usedWincAmount = W(used_winc_amount);
          const newUsedWincAmount = usedWincAmount.isGreaterThanOrEqualTo(
            remainingWincToRefundToApprovals
          )
            ? usedWincAmount.minus(remainingWincToRefundToApprovals)
            : W(0);
          const res = (
            await knexTransaction<InactiveDelegatedPaymentApprovalDBResult>(
              tableNames.inactiveDelegatedPaymentApproval
            )
              .where({
                approval_data_item_id,
              })
              .del()
              .returning("*")
          )[0];

          const delegatedDbInsert: DelegatedPaymentApprovalDBInsert = {
            approval_data_item_id: res.approval_data_item_id,
            approved_address: res.approved_address,
            paying_address: res.paying_address,
            approved_winc_amount: res.approved_winc_amount,
            expiration_date: res.expiration_date,
            used_winc_amount: newUsedWincAmount.toString(),
          };

          await knexTransaction<DelegatedPaymentApprovalDBResult>(
            tableNames.delegatedPaymentApproval
          ).insert(delegatedDbInsert);

          remainingWincToRefundToApprovals =
            remainingWincToRefundToApprovals.minus(W(used_winc_amount));
          // end inactive approvals
        }
      } else {
        // Refund to the signer
        const user = await this.getLockedUser(paying_address, knexTransaction);
        const newBalance = user.winstonCreditBalance.plus(winc_amount);
        await knexTransaction<UserDBResult>(tableNames.user)
          .where({
            user_address: paying_address,
          })
          .update({ winston_credit_balance: newBalance.toString() });
        const auditLogInsert: AuditLogInsert = {
          user_address: paying_address,
          winston_credit_amount: winc_amount.toString(),
          change_reason: changeReason,
          change_id: changeId,
        };
        await knexTransaction(tableNames.auditLog).insert(auditLogInsert);
      }
    }
  }
}
