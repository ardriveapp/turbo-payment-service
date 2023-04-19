export const isTestEnv = process.env.NODE_ENV === "test";

const testEnvPort = 1235;
const prodEnvPort = 3000;

export const defaultPort = isTestEnv ? testEnvPort : prodEnvPort;
export const msPerMinute = 1000 * 60;

export const TEST_PRIVATE_ROUTE_SECRET = "test-secret";
