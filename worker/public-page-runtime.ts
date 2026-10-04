import { isPublicSeoPage, isSitemapPath } from "../lib/seo";
import { sitemapResponse } from "../lib/seo-sitemap";

// Render public content in the existing SQLite DO allowance, not the Free
// Worker's 10ms allowance. Compiled renderer modules are reused by the isolate.
// All visitors receive the same public data; private UI still loads via APIs.
export async function publicPageResponse(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
  const url = new URL(request.url);
  if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405 });
  if (isSitemapPath(url.pathname)) {
    const response = await sitemapResponse(url.pathname);
    return request.method === "HEAD" ? new Response(null, { status: response.status, headers: response.headers }) : response;
  }
  if (!isPublicSeoPage(url.pathname)) return new Response(null, { status: 404 });
  const headers = new Headers(request.headers);
  for (const key of Array.from(headers.keys())) if (key === "cookie" || key === "authorization" || key.startsWith("oai-authenticated-user-") || key.startsWith("x-nhadepchat-")) headers.delete(key);
  const anonymous = new Request(request, { headers });
  const { default: renderer } = await import("vinext/server/fetch-handler");
  const response = await renderer.fetch(anonymous, env, ctx);
  const resultHeaders = new Headers(response.headers);
  resultHeaders.delete("Set-Cookie");
  // Re-check live visibility on every request; hidden/deleted/private posts
  // must never survive in an HTML cache. Do not cache personalized responses.
  resultHeaders.set("Cache-Control", "private, no-store");
  return new Response(request.method === "HEAD" ? null : response.body, { status: response.status, headers: resultHeaders });
}
