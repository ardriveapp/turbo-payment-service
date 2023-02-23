export interface BytesToAROracle {
  getARForBytes: (bytes: number) => Promise<number>;
}
