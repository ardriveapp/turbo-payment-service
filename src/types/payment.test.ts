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
import { expect } from "chai";

import { paymentAmountLimits } from "../constants";
import {
  InvalidPaymentAmount,
  UnsupportedCurrencyType,
} from "../database/errors";
import { Payment } from "./payment";
import { supportedFiatPaymentCurrencyTypes } from "./supportedCurrencies";

describe("Payment class", () => {
  describe("constructor", () => {
    it("constructs a Payment without error when provided each supported currency type", () => {
      for (const curr of supportedFiatPaymentCurrencyTypes) {
        expect(
          () =>
            new Payment({
              amount: paymentAmountLimits[curr].minimumPaymentAmount * 10,
              type: curr,
            })
        ).to.not.throw(Error);
        expect(
          () =>
            new Payment({
              amount: paymentAmountLimits[curr].minimumPaymentAmount * 100,
              type: curr,
            })
        ).to.not.throw(Error);
        expect(
          () =>
            new Payment({
              amount: paymentAmountLimits[curr].maximumPaymentAmount,
              type: curr,
            })
        ).to.not.throw(Error);
      }
    });

    it("throws an error when provided an un-supported currency type", () => {
      expect(() => new Payment({ amount: 100, type: "bad" })).to.throw(
        UnsupportedCurrencyType,
        "The currency type 'bad' is currently not supported by this API!"
      );
      expect(() => new Payment({ amount: 100, type: "nope" })).to.throw(
        UnsupportedCurrencyType,
        "The currency type 'nope' is currently not supported by this API!"
      );
      expect(() => new Payment({ amount: 100, type: "!!!" })).to.throw(
        UnsupportedCurrencyType,
        "The currency type '!!!' is currently not supported by this API!"
      );
      expect(() => new Payment({ amount: 100, type: "123" })).to.throw(
        UnsupportedCurrencyType,
        "The currency type '123' is currently not supported by this API!"
      );
    });

    it("throws an error when provided an un-supported payment amount", () => {
      expect(() => new Payment({ amount: -5, type: "usd" })).to.throw(
        InvalidPaymentAmount,
        "The provided payment amount (-5) is invalid; it must be a positive non-decimal integer!"
      );
      expect(() => new Payment({ amount: 123.456, type: "gbp" })).to.throw(
        InvalidPaymentAmount,
        "The provided payment amount (123.456) is invalid; it must be a positive non-decimal integer!"
      );
      expect(
        () => new Payment({ amount: 123456789.456123, type: "jpy" })
      ).to.throw(
        InvalidPaymentAmount,
        "The provided payment amount (123456789.456123) is invalid; it must be a positive non-decimal integer!"
      );
      expect(
        () => new Payment({ amount: Number.MAX_SAFE_INTEGER + 1, type: "aud" })
      ).to.throw(
        InvalidPaymentAmount,
        "The provided payment amount (9007199254740992) is invalid; it must be a positive non-decimal integer!"
      );
      expect(
        () => new Payment({ amount: Number.POSITIVE_INFINITY, type: "sgd" })
      ).to.throw(
        InvalidPaymentAmount,
        "The provided payment amount (Infinity) is invalid; it must be a positive non-decimal integer!"
      );
      expect(() => new Payment({ amount: NaN, type: "inr" })).to.throw(
        InvalidPaymentAmount,
        "The provided payment amount (NaN) is invalid; it must be a positive non-decimal integer!"
      );
    });
  });
});
