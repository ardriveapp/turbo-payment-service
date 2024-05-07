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
import { WC } from "../types";

abstract class Price {
  constructor(public readonly winc: WC) {}

  toString(): string {
    return this.winc.toString();
  }
  valueOf(): string {
    return this.winc.valueOf();
  }
  toJSON(): string {
    return this.winc.toJSON();
  }
}

export class NetworkPrice extends Price {
  constructor(public readonly winc: WC) {
    super(winc);
  }
}

export class SubtotalPrice extends Price {
  constructor(public readonly winc: WC) {
    super(winc);
  }

  static addFromNetworkPrice(
    networkPrice: NetworkPrice,
    winc: WC
  ): SubtotalPrice {
    return new SubtotalPrice(networkPrice.winc).add(winc);
  }

  static multiplyFromNetworkPrice(
    networkPrice: NetworkPrice,
    multiple: number
  ): SubtotalPrice {
    return new SubtotalPrice(networkPrice.winc).multiply(multiple);
  }

  public add(winc: WC): SubtotalPrice {
    return new SubtotalPrice(this.winc.plus(winc));
  }
  public multiply(multiple: number): SubtotalPrice {
    return new SubtotalPrice(this.winc.times(multiple));
  }
}

export class FinalPrice extends Price {
  constructor(public readonly winc: WC) {
    super(winc);
  }

  static fromSubtotal(subtotal: SubtotalPrice) {
    return new FinalPrice(subtotal.winc);
  }
}
