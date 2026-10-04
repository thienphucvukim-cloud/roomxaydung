import { DurableObject } from "cloudflare:workers";
import { cloudflareRequest } from "../lib/cloudflare-request";
import { dispatchApi } from "./api-router";
import { discardUnreadBody } from "./request-body";
import { isPublicSeoPage, isSitemapPath } from "../lib/seo";
import { publicPageResponse } from "./public-page-runtime";

// Free SQLite-backed DOs have a separate 30-second CPU allowance, allowing
// unchanged scrypt and transactional APIs. Storage is deliberately unused.
// Sixteen stateless shards avoid a single request queue. Auth/cookie context
// remains isolated per request inside dispatchApi's AsyncLocalStorage scope.
export class ApiRuntime extends DurableObject<Cloudflare.Env> {
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (isPublicSeoPage(path) || isSitemapPath(path)) return publicPageResponse(request, this.env, this.ctx as unknown as ExecutionContext);
    if (!new URL(request.url).pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
    const response = await dispatchApi(cloudflareRequest(request));
    await discardUnreadBody(request);
    return response;
  }
}
