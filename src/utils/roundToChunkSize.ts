import { ByteCount } from "../types/byteCount";
import { PositiveFiniteInteger } from "../types/positiveFiniteInteger";

export function roundToArweaveChunkSize(bytesCount: ByteCount): ByteCount {
  const chunkSize = 256 * 1024;
  return new PositiveFiniteInteger(
    Math.ceil(bytesCount.valueOf() / chunkSize) * chunkSize
  );
}
