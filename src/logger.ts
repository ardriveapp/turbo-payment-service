import { TransformableInfo } from "logform";
import { createLogger, format, transports } from "winston";

const { combine, colorize, printf } = format;

const seemsLikeAnError = (info: TransformableInfo) =>
  info && (info instanceof Error || (info.message && info.stack));

const containsAnError = (info: TransformableInfo) =>
  info && "error" in info && seemsLikeAnError(info.error);

function devFormat() {
  const formatSimple = (info: TransformableInfo) => {
    const infoAfter = format.simple().transform(info) as TransformableInfo;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return `${infoAfter[Symbol.for("message") as any]}`;
  };
  const formatWrappedError = (info: TransformableInfo) =>
    `${info.level} ${info.message}\n\n${info.error.stack}\n`;
  const formatError = (info: TransformableInfo) =>
    `${info.level} ${info.message}\n\n${info.stack}\n`;
  const formatAny = (info: TransformableInfo) =>
    seemsLikeAnError(info)
      ? formatError(info)
      : containsAnError(info)
      ? formatWrappedError(info)
      : formatSimple(info);
  return combine(colorize(), printf(formatAny));
}

const logger = createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  transports: [new transports.Console()],
  format: process.env.DEV_LOGS === "1" ? devFormat() : format.simple(),
  silent: false,
});

export default logger;
