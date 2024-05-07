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

import { W, Winston } from "./winston";

export class AR {
  constructor(readonly winston: Winston) {}

  static from(arValue: BigNumber.Value): AR {
    const bigWinston = new BigNumber(arValue).shiftedBy(12);
    const numDecimalPlaces = bigWinston.decimalPlaces() ?? 0;
    if (numDecimalPlaces > 0) {
      throw new Error(
        `The AR amount must have a maximum of 12 digits of precision, but got ${
          numDecimalPlaces + 12
        }`
      );
    }
    return new AR(W(bigWinston));
  }

  toString(): string {
    BigNumber.config({ DECIMAL_PLACES: 12 });
    const w = new BigNumber(this.winston.toString(), 10);
    return w.shiftedBy(-12).toFixed();
  }

  valueOf(): string {
    return this.toString();
  }

  toWinston(): Winston {
    return this.winston;
  }

  toJSON(): string {
    return this.toString();
  }
}
