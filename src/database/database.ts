export interface Database {
  getPriceQuote: (
    walletAddress: string
  ) => Promise<{ walletAddress: string; balance: number }>;
  createPriceQuote: () => Promise<{ walletAddress: string; balance: number }>;
  getPaymentReceipt: (
    walletAddress: string
  ) => Promise<{ walletAddress: string; balance: number }>;
  createPaymentReceipt: (
    walletAddress: string
  ) => Promise<{ walletAddress: string; balance: number }>;
  getRefundReceipt: (
    walletAddress: string
  ) => Promise<{ walletAddress: string; balance: number }>;
  createRefundReceipt: (
    walletAddress: string
  ) => Promise<{ walletAddress: string; balance: number }>;
  expirePriceQuote: (
    walletAddress: string
  ) => Promise<{ walletAddress: string; balance: number }>;
  getUserBalance: (
    walletAddress: string
  ) => Promise<{ walletAddress: string; balance: number }>;
  updateUserBalance: (
    walletAddress: string,
    balance: number
  ) => Promise<{ walletAddress: string; balance: number }>;
}

export class TestDatabase implements Database {
  getPriceQuote = (walletAddress: string) =>
    Promise.resolve({ walletAddress: walletAddress, balance: 10 });
  createPriceQuote = () => Promise.resolve({ walletAddress: "", balance: 0 });
  expirePriceQuote = (walletAddress: string) =>
    Promise.resolve({ walletAddress: walletAddress, balance: 0 });
  getUserBalance = (walletAddress: string) =>
    Promise.resolve({ walletAddress: walletAddress, balance: 0 });
  updateUserBalance = (walletAddress: string, balance: number) =>
    Promise.resolve({ walletAddress: walletAddress, balance: balance });
  getPaymentReceipt = (walletAddress: string) =>
    Promise.resolve({ walletAddress: walletAddress, balance: 0 });
  createPaymentReceipt = (walletAddress: string) =>
    Promise.resolve({ walletAddress: walletAddress, balance: 0 });
  getRefundReceipt = (walletAddress: string) =>
    Promise.resolve({ walletAddress: walletAddress, balance: 0 });
  createRefundReceipt = (walletAddress: string) =>
    Promise.resolve({ walletAddress: walletAddress, balance: 0 });
}
