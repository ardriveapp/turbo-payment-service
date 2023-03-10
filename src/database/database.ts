export interface Database {
  getPriceQuote: () => Promise<{ address: string; balance: number }>;
  createPriceQuote: () => Promise<{ address: string; balance: number }>;
  getReceipt: () => Promise<{ address: string; balance: number }>;
  createReceipt: () => Promise<{ address: string; balance: number }>;
}

export class TestDatabase implements Database {
  getPriceQuote = () => Promise.resolve({ address: "", balance: 0 });
  createPriceQuote = () => Promise.resolve({ address: "", balance: 0 });
  getReceipt = () => Promise.resolve({ address: "", balance: 0 });
  createReceipt = () => Promise.resolve({ address: "", balance: 0 });
}
