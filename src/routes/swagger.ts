import { readFileSync } from "fs";
import { koaSwagger } from "koa2-swagger-ui";
import Router from "koa-router";
import YAML from "yaml";

export function addSwaggerRoutes(router: Router) {
  const openApiSpec = YAML.parse(readFileSync("docs/openapi.yaml", "utf8"));

  router.get("/openapi.json", (ctx, next) => {
    ctx.response.body = JSON.stringify(openApiSpec, null, 2);
    return next;
  });

  router.get(
    "/api-docs",
    koaSwagger({ routePrefix: false, swaggerOptions: { spec: openApiSpec } })
  );
}
