import { expect } from "chai";

import { ByteCount } from "../types/types";
import { roundToArweaveChunkSize } from "./roundToChunkSize";

describe("roundToChunkSize function", () => {
  it("returns the correct PositiveFiniteInteger number value", () => {
    const byteSize = ByteCount(12345);
    const rounded = ByteCount(262144);
    expect(roundToArweaveChunkSize(byteSize)).to.deep.equal(rounded);
  });
});
