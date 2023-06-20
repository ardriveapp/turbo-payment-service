export * from "./positiveFiniteInteger";
export * from "./equatable";
export * from "./ar";
export * from "./winston";
export * from "./arc";
export * from "./byteCount";

export type Base64URLString = string;
export type RSAModulusString = Base64URLString;
export type PublicKeyString = RSAModulusString; // TODO: add other supported public key types (ETH, SOL)
export type PublicArweaveAddress = Base64URLString;
export type TransactionId = Base64URLString;
