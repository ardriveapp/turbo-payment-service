import { ByteCount } from "../types/byteCount";

export function roundToArweaveChunkSize(bytesCount: ByteCount): ByteCount {
  const chunkSize = 256 * 1024;
  return ByteCount(Math.ceil(bytesCount.valueOf() / chunkSize) * chunkSize);
}
