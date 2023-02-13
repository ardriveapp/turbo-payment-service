export interface Database {
  goodbyeUniverse: () => Promise<{ address: string; balance: number }>;
}
