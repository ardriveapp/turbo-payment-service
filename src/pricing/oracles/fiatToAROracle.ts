export interface FiatToAROracle {
  getARForFiat: (fiat: string) => Promise<number>;
}
