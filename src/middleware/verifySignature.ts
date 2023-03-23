import Arweave from "arweave";
import { Context, Next } from "koa";

export async function verifyArweaveSignature(
  publicKey: string,
  signature: Uint8Array,
  additionalData: string | undefined,
  nonce: string
): Promise<boolean> {
  if (!signature || !publicKey || !nonce) {
    return false;
  }
  let dataToVerify: string;

  if (additionalData) {
    dataToVerify = additionalData + nonce;
  } else {
    dataToVerify = nonce;
  }
  console.log("dataToVerify", dataToVerify);
  const isVerified = await Arweave.crypto.verify(
    publicKey,
    signature,
    Arweave.utils.stringToBuffer(dataToVerify)
  );

  return isVerified;
}

export async function verifySignature(ctx: Context, next: Next): Promise<void> {
  try {
    const signature = ctx.request.headers["x-signature"];
    const publicKey = ctx.request.headers["x-public-key"];
    const nonce = ctx.request.headers["x-nonce"];

    const isVerified = await verifyArweaveSignature(
      publicKey as string,
      Arweave.utils.stringToBuffer(signature as string),
      Object.keys(ctx.request.query).length
        ? JSON.stringify(ctx.request.query)
        : undefined,
      nonce as string
    );

    if (isVerified) {
      ctx.state.walletAddress = ctx.request.headers["x-public-key"];
      await next();
    } else {
      ctx.status = isVerified ? 0 : 403;
      ctx.body = isVerified
        ? ""
        : "Invalid signature or missing required headers";
    }
  } catch (error) {
    console.error(error);
    ctx.status = 500;
    ctx.body = "Internal Server Error";
  }
}
