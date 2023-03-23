export interface Database {
  getPriceQuote: (
    walletAddress: string
  ) => Promise<{ address: string; balance: number }>;
  createPriceQuote: () => Promise<{ address: string; balance: number }>;
  getPaymentReceipt: (
    walletAddress: string
  ) => Promise<{ address: string; balance: number }>;
  createPaymentReceipt: (
    walletAddress: string
  ) => Promise<{ address: string; balance: number }>;
  getBalance: (
    walletAddress: string
  ) => Promise<{ address: string; balance: number }>;
}

export class TestDatabase implements Database {
  getPriceQuote = (walletAddress: string) =>
    Promise.resolve({ address: walletAddress, balance: 10 });
  createPriceQuote = () => Promise.resolve({ address: "", balance: 0 });
  getPaymentReceipt = (walletAddress: string) =>
    Promise.resolve({ address: walletAddress, balance: 0 });
  createPaymentReceipt = (walletAddress: string) =>
    Promise.resolve({ address: walletAddress, balance: 0 });
  getBalance = (walletAddress: string) =>
    Promise.resolve({ address: walletAddress, balance: 10 });
}
