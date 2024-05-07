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

import { PositiveFiniteInteger } from "./positiveFiniteInteger";

describe("PositiveFiniteInteger class", () => {
  describe("constructor", () => {
    it("constructs valid PositiveFiniteIntegers given healthy inputs", () => {
      const posPositiveFiniteIntegerInputs = [0, 1, Number.MAX_SAFE_INTEGER];
      posPositiveFiniteIntegerInputs.forEach((posPositiveFiniteInteger) =>
        expect(
          () => new PositiveFiniteInteger(posPositiveFiniteInteger)
        ).to.not.throw(Error)
      );
    });

    it("throws an error when provided invalid inputs", () => {
      const posPositiveFiniteIntegerInputs = [
        -1,
        0.5,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NaN,
      ];
      posPositiveFiniteIntegerInputs.forEach((posPositiveFiniteInteger) =>
        expect(
          () => new PositiveFiniteInteger(posPositiveFiniteInteger),
          `${posPositiveFiniteInteger} should throw`
        ).to.throw(Error)
      );
    });
  });

  describe("toPrimitive function", () => {
    it("returns the correct PositiveFiniteInteger string when hint is string", () => {
      const posPositiveFiniteInteger = new PositiveFiniteInteger(12345);
      expect(`${posPositiveFiniteInteger}`).to.equal("12345");
    });

    it("returns the correct PositiveFiniteInteger number when hint is number", () => {
      const posPositiveFiniteInteger = new PositiveFiniteInteger(12345);
      expect(+posPositiveFiniteInteger).to.equal(12345);
    });
  });

  describe("toString function", () => {
    it("returns the correct PositiveFiniteInteger string", () => {
      const posPositiveFiniteInteger = new PositiveFiniteInteger(12345);
      expect(posPositiveFiniteInteger.toString()).to.equal("12345");
    });
  });

  describe("valueOf function", () => {
    it("returns the correct PositiveFiniteInteger number value", () => {
      const eid = new PositiveFiniteInteger(12345);
      expect(eid.valueOf()).to.equal(12345);
    });
  });

  describe("equals function", () => {
    it("correctly evaluates equality", () => {
      const bc1 = new PositiveFiniteInteger(12345);
      const bc2 = new PositiveFiniteInteger(12345);
      const bc3 = new PositiveFiniteInteger(0);
      expect(bc1.equals(bc2), `${bc1} and ${bc2}`).to.be.true;
      expect(bc2.equals(bc1), `${bc2} and ${bc1}`).to.be.true;
      expect(bc1.equals(bc3), `${bc1} and ${bc3}`).to.be.false;
      expect(bc3.equals(bc1), `${bc3} and ${bc1}`).to.be.false;
      expect(bc2.equals(bc3), `${bc2} and ${bc3}`).to.be.false;
      expect(bc3.equals(bc2), `${bc3} and ${bc2}`).to.be.false;
    });
  });

  describe("toJSON function", () => {
    it("returns the correct JSON value", () => {
      const posPositiveFiniteInteger = new PositiveFiniteInteger(12345);
      expect(JSON.stringify({ posPositiveFiniteInteger })).to.equal(
        '{"posPositiveFiniteInteger":12345}'
      );
    });
  });

  describe("plus function", () => {
    it("correctly sums up PositiveFiniteInteger values", () => {
      expect(
        new PositiveFiniteInteger(1)
          .plus(new PositiveFiniteInteger(2))
          .toString()
      ).to.equal("3");
    });
  });

  describe("minus function", () => {
    it("correctly subtracts PositiveFiniteInteger values", () => {
      expect(
        new PositiveFiniteInteger(2)
          .minus(new PositiveFiniteInteger(1))
          .toString()
      ).to.equal("1");
    });

    it("throws an error when the subtraction result is less than 0", () => {
      expect(() =>
        new PositiveFiniteInteger(1).minus(new PositiveFiniteInteger(2))
      ).to.throw(Error);
    });
  });

  describe("isGreaterThan function", () => {
    it("returns false when other PositiveFiniteInteger is greater", () => {
      expect(
        new PositiveFiniteInteger(1).isGreaterThan(new PositiveFiniteInteger(2))
      ).to.be.false;
    });

    it("returns true when other PositiveFiniteInteger is lesser", () => {
      expect(
        new PositiveFiniteInteger(2).isGreaterThan(new PositiveFiniteInteger(1))
      ).to.be.true;
    });

    it("returns false when other PositiveFiniteInteger is equal", () => {
      expect(
        new PositiveFiniteInteger(2).isGreaterThan(new PositiveFiniteInteger(2))
      ).to.be.false;
    });
  });

  describe("isGreaterThanOrEqualTo function", () => {
    it("returns false when other PositiveFiniteInteger is greater", () => {
      expect(
        new PositiveFiniteInteger(1).isGreaterThanOrEqualTo(
          new PositiveFiniteInteger(2)
        )
      ).to.be.false;
    });

    it("returns true when other PositiveFiniteInteger is lesser", () => {
      expect(
        new PositiveFiniteInteger(2).isGreaterThanOrEqualTo(
          new PositiveFiniteInteger(1)
        )
      ).to.be.true;
    });

    it("returns true when other PositiveFiniteInteger is equal", () => {
      expect(
        new PositiveFiniteInteger(2).isGreaterThanOrEqualTo(
          new PositiveFiniteInteger(2)
        )
      ).to.be.true;
    });
  });
});
