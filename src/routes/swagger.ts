import { readFileSync } from "fs";
import { Next } from "koa";
import { koaSwagger } from "koa2-swagger-ui";
import YAML from "yaml";

import logger from "../logger";
import { KoaContext } from "../server";

function loadSwaggerYAML() {
  try {
    return YAML.parse(readFileSync("docs/openapi.yaml", "utf8"));
  } catch (error) {
    logger.error(error);
    throw Error("OpenAPI spec could not be read!");
  }
}
export function swaggerDocsJSON(ctx: KoaContext, next: Next) {
  ctx.response.body = JSON.stringify(loadSwaggerYAML(), null, 2);
  return next;
}

export const swaggerDocs = koaSwagger({
  routePrefix: false,
  swaggerOptions: { spec: loadSwaggerYAML() },
});
