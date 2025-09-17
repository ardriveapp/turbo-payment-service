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
import BigNumber from "bignumber.js";
import { expect } from "chai";

import { Winston } from "./winston";

describe("Winston class", () => {
  describe("constructor", () => {
    it("constructor throws an exception when a non-integer Winston value is provided", () => {
      expect(() => new Winston(0.5)).to.throw(Error);
      expect(() => new Winston("0.5")).to.throw(Error);
      expect(() => new Winston("abc")).to.throw(Error);
      expect(() => new Winston("!!!")).to.throw(Error);
      expect(() => new Winston("-")).to.throw(Error);
      expect(() => new Winston("+")).to.throw(Error);
    });

    it("constructor builds Winston values for positive integer number values without throwing an error", () => {
      expect(() => new Winston(0)).to.not.throw(Error);
      expect(() => new Winston(1)).to.not.throw(Error);
      expect(() => new Winston(Number.MAX_SAFE_INTEGER)).to.not.throw(Error);
    });

    // Not concerned with other number notations for now, e.g. scientific notation
    it("constructor builds Winston values for positive integer strings without throwing an error", () => {
      expect(() => new Winston("0")).to.not.throw(Error);
      expect(() => new Winston("1")).to.not.throw(Error);
    });

    it("constructor builds Winston values for negative integer strings without throwing an error", () => {
      expect(() => new Winston("-1")).to.not.throw(Error);
      expect(() => new Winston("-10")).to.not.throw(Error);
    });

    it("constructor builds Winston values for positive BigNumber integer strings", () => {
      expect(() => new Winston("18014398509481982")).to.not.throw(Error);
    });

    it("constructor builds Winston values for a negative BigNumber integer strings", () => {
      expect(() => new Winston("-18014398509481982")).to.not.throw(Error);
    });
  });

  describe("plus function", () => {
    it("correctly sums up Winston values", () => {
      expect(new Winston(1).plus(new Winston(2)).toString()).to.equal("3");
    });

    it("correctly sums up Winston values in the BigNumber ranges", () => {
      expect(
        new Winston(Number.MAX_SAFE_INTEGER)
          .plus(new Winston(Number.MAX_SAFE_INTEGER))
          .toString()
      ).to.equal("18014398509481982");
    });
  });

  describe("minus function", () => {
    it("correctly subtracts Winston values", () => {
      expect(new Winston(2).minus(new Winston(1)).toString()).to.equal("1");
    });

    it("correctly subtracts Winston values in the BigNumber ranges", () => {
      expect(
        new Winston("18014398509481982")
          .minus(new Winston(Number.MAX_SAFE_INTEGER))
          .toString()
      ).to.equal("9007199254740991");
    });

    it("correctly calculates negative Winston value when subtraction result is less than 0", () => {
      expect(new Winston(1).minus(new Winston(2)).toString()).to.equal("-1");
    });
  });

  describe("times function", () => {
    it("correctly multiplies Winston values by whole and fractional numbers", () => {
      expect(new Winston(2).times(3).toString()).to.equal("6");
      expect(new Winston(2).times(1.5).toString()).to.equal("3");
    });

    it("correctly multiplies Winston values by whole and fractional BigNumbers", () => {
      expect(new Winston(2).times(Number.MAX_SAFE_INTEGER).toString()).to.equal(
        "18014398509481982"
      );
      expect(new Winston(2).times("18014398509481982").toString()).to.equal(
        "36028797018963964"
      );
    });

    it("rounds down multiplications that result in fractional numbers", () => {
      expect(new Winston(2).times(1.6).toString()).to.equal("3");
      expect(
        new Winston(Number.MAX_SAFE_INTEGER).times(1.5).toString()
      ).to.equal("13510798882111486");
    });

    it("correctly multiplies Winston values when multiplying by negative numbers", () => {
      expect(new Winston(1).times(-1).toString()).to.equal("-1");
    });
  });

  describe("dividedBy function", () => {
    it("correctly divides Winston values by whole and fractional numbers", () => {
      expect(new Winston(6).dividedBy(3).toString()).to.equal("2");
      expect(new Winston(6).dividedBy(1.5).toString()).to.equal("4");
    });

    it("correctly divides Winston values by whole and fractional BigNumbers", () => {
      expect(
        new Winston("18014398509481982")
          .dividedBy(Number.MAX_SAFE_INTEGER)
          .toString()
      ).to.equal("2");
      expect(
        new Winston("36028797018963965")
          .dividedBy("18014398509481982.5")
          .toString()
      ).to.equal("2");
    });

    it("rounds up divisions that result in fractional numbers by default", () => {
      expect(new Winston(3).dividedBy(2).toString()).to.equal("2");
      expect(new Winston("13510798882111487").dividedBy(2).toString()).to.equal(
        "6755399441055744"
      );
    });

    it("rounds down divisions that result in fractional numbers when ROUND_DOWN is specified", () => {
      expect(new Winston(3).dividedBy(2, "ROUND_DOWN").toString()).to.equal(
        "1"
      );
      expect(new Winston("13510798882111487").dividedBy(2).toString()).to.equal(
        "6755399441055744"
      );
    });

    it("correctly divides Winston values when dividing by negative numbers", () => {
      expect(new Winston(1).dividedBy(-1).toString()).to.equal("-1");
    });
  });

  describe("isGreaterThan function", () => {
    it("returns false when other Winston is greater", () => {
      expect(new Winston(1).isGreaterThan(new Winston(2))).to.be.false;
    });

    it("returns true when other Winston is lesser", () => {
      expect(new Winston(2).isGreaterThan(new Winston(1))).to.be.true;
    });

    it("returns false when other Winston is equal", () => {
      expect(new Winston(2).isGreaterThan(new Winston(2))).to.be.false;
    });
  });

  describe("isGreaterThanOrEqualTo function", () => {
    it("returns false when other Winston is greater", () => {
      expect(new Winston(1).isGreaterThanOrEqualTo(new Winston(2))).to.be.false;
    });

    it("returns true when other Winston is lesser", () => {
      expect(new Winston(2).isGreaterThanOrEqualTo(new Winston(1))).to.be.true;
    });

    it("returns true when other Winston is equal", () => {
      expect(new Winston(2).isGreaterThanOrEqualTo(new Winston(2))).to.be.true;
    });
  });

  describe("isNonZeroPositiveInteger", () => {
    it("returns true for a positive non zero integer", () => {
      expect(new Winston(1).isNonZeroPositiveInteger()).to.be.true;
    });

    it("returns false for 0", () => {
      expect(new Winston(0).isNonZeroPositiveInteger()).to.be.false;
    });

    it("returns false for a negative non-zero integer", () => {
      expect(new Winston(-1).isNonZeroPositiveInteger()).to.be.false;
    });
  });

  describe("isNonZeroNegativeInteger", () => {
    it("returns true for a negative non zero integer", () => {
      expect(new Winston(-1).isNonZeroNegativeInteger()).to.be.true;
    });

    it("returns false for 0", () => {
      expect(new Winston(0).isNonZeroNegativeInteger()).to.be.false;
    });

    it("returns false for a positive non-zero integer", () => {
      expect(new Winston(1).isNonZeroNegativeInteger()).to.be.false;
    });
  });

  describe("difference function", () => {
    it("can return a positive difference between Winstons", () => {
      expect(Winston.difference(new Winston(2), new Winston(1))).to.equal("1");
    });

    it("can return a negative difference between Winstons", () => {
      expect(Winston.difference(new Winston(1), new Winston(2))).to.equal("-1");
    });
  });

  describe("toString function", () => {
    it("returns the Winston value as a BigNumber string", () => {
      expect(new Winston(0).toString()).to.equal("0");
      expect(new Winston(1).toString()).to.equal("1");
      expect(new Winston("18014398509481982").toString()).to.equal(
        "18014398509481982"
      );
    });
  });

  describe("valueOf function", () => {
    it("returns the Winston value as a BigNumber string", () => {
      expect(new Winston(0).valueOf()).to.equal("0");
      expect(new Winston(1).valueOf()).to.equal("1");
      expect(new Winston("18014398509481982").valueOf()).to.equal(
        "18014398509481982"
      );
    });
  });

  describe("toBigNumber function", () => {
    it("returns the Winston value as a BigNumber", () => {
      expect(new Winston(0).valueOf()).to.equal("0");
      expect(new Winston(1).valueOf()).to.equal("1");
      expect(new Winston(18014398509481982).toBigNumber().toNumber).to.equal(
        BigNumber(18014398509481982).toNumber
      );
    });
  });

  describe("max function", () => {
    it("correctly computes the max Winston value from an aritrarily large list of Winston values", () => {
      expect(
        `${Winston.max(
          new Winston("18014398509481982"),
          new Winston(Number.MAX_SAFE_INTEGER),
          new Winston(1),
          new Winston(0)
        )}`
      ).to.equal("18014398509481982");
    });
  });

  describe("isEqualTo function", () => {
    it("returns true when two Winston values are equal", () => {
      expect(new Winston(1).isEqualTo(new Winston(1))).to.be.true;
    });

    it("returns false when two Winston values are not equal", () => {
      expect(new Winston(1).isEqualTo(new Winston(2))).to.be.false;
    });
  });

  describe("isZero function", () => {
    it("returns true when Winston value is 0", () => {
      expect(new Winston(0).isZero()).to.be.true;
    });

    it("returns false when Winston value is not 0", () => {
      expect(new Winston(1).isZero()).to.be.false;
    });
  });
});
