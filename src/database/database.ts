export interface Database {
  getPaymentQuote: (
    walletAddress: string
  ) => Promise<{ address: string; balance: number }>;
  createPriceQuote: () => Promise<{ address: string; balance: number }>;
  getReceipt: (
    walletAddress: string
  ) => Promise<{ address: string; balance: number }>;
  createReceipt: (
    walletAddress: string
  ) => Promise<{ address: string; balance: number }>;
}

export class TestDatabase implements Database {
  getPaymentQuote = (walletAddress: string) =>
    Promise.resolve({ address: walletAddress, balance: 10 });
  createPriceQuote = () => Promise.resolve({ address: "", balance: 0 });
  getReceipt = (walletAddress: string) =>
    Promise.resolve({ address: walletAddress, balance: 0 });
  createReceipt = (walletAddress: string) =>
    Promise.resolve({ address: walletAddress, balance: 0 });
}
