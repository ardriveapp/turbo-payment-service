import { expect } from "chai";

import { PositiveFiniteInteger } from "../types/positiveFiniteInteger";
import { roundToArweaveChunkSize } from "./roundToChunkSize";

describe("roundToChunkSize function", () => {
  it("returns the correct PositiveFiniteInteger number value", () => {
    const byteSize = new PositiveFiniteInteger(12345);
    const rounded = new PositiveFiniteInteger(262144);
    expect(roundToArweaveChunkSize(byteSize)).to.deep.equal(rounded);
  });
});
