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
import { BigNumber } from "bignumber.js";

export class Winston {
  private amount: BigNumber;
  constructor(amount: BigNumber.Value) {
    this.amount = new BigNumber(amount);
    if (!this.amount.isInteger()) {
      throw new Error("Winston value should be an integer!");
    }
  }

  plus(winston: Winston): Winston {
    return W(this.amount.plus(winston.amount));
  }

  minus(winston: Winston): Winston {
    return W(this.amount.minus(winston.amount));
  }

  times(
    multiplier: BigNumber.Value,
    round: "ROUND_DOWN" | "ROUND_CEIL" = "ROUND_DOWN"
  ): Winston {
    return W(
      this.amount
        .times(multiplier)
        .decimalPlaces(
          0,
          round === "ROUND_DOWN" ? BigNumber.ROUND_DOWN : BigNumber.ROUND_CEIL
        )
    );
  }

  dividedBy(
    divisor: BigNumber.Value,
    round: "ROUND_DOWN" | "ROUND_CEIL" = "ROUND_CEIL"
  ): Winston {
    return W(
      this.amount
        .dividedBy(divisor)
        .decimalPlaces(
          0,
          round === "ROUND_DOWN" ? BigNumber.ROUND_DOWN : BigNumber.ROUND_CEIL
        )
    );
  }

  isGreaterThan(winston: Winston): boolean {
    return this.amount.isGreaterThan(winston.amount);
  }

  isLessThan(winston: Winston): boolean {
    return this.amount.isLessThan(winston.amount);
  }

  isEqualTo(winston: Winston): boolean {
    return this.amount.isEqualTo(winston.amount);
  }

  isZero(): boolean {
    return this.amount.isZero();
  }

  isNonZeroPositiveInteger(): boolean {
    return this.amount.isGreaterThan(0) && this.amount.isInteger();
  }

  isNonZeroNegativeInteger(): boolean {
    return this.amount.isLessThan(0) && this.amount.isInteger();
  }

  isGreaterThanOrEqualTo(winston: Winston): boolean {
    return this.amount.isGreaterThanOrEqualTo(winston.amount);
  }

  static difference(a: Winston, b: Winston): string {
    return a.amount.minus(b.amount).toString();
  }

  toString(): string {
    return this.amount.toFixed();
  }

  valueOf(): string {
    return this.amount.toFixed();
  }
  toBigNumber(): BigNumber {
    return this.amount;
  }

  toJSON(): string {
    return this.toString();
  }

  static max(...winstons: Winston[]): Winston {
    BigNumber.max();
    return winstons.reduce((max, next) =>
      next.amount.isGreaterThan(max.amount) ? next : max
    );
  }
}

export function W(amount: BigNumber.Value): Winston {
  return new Winston(amount);
}

export function winstonToCredits(winston: Winston): string {
  BigNumber.config({ DECIMAL_PLACES: 12 });
  const w = new BigNumber(winston.toString(), 10);
  return w.shiftedBy(-12).toFixed();
}

export function wincFromCredits(credits: number): Winston {
  const w = new BigNumber(credits, 10);
  return W(w.shiftedBy(12).toFixed());
}
