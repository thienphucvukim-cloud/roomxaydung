import { getAndClearPendingCookies, headersContextFromRequest, runWithHeadersContext, setHeadersAccessPhase } from "vinext/shims/headers";
import { GUEST_ID_PATTERN, MEMBER_SESSION_COOKIE } from "../lib/session-cookie";
import { discardUnreadBody } from "./request-body";

type ApiHandler = (request: Request, context: { params: Promise<Record<string, string>> }) => Response | Promise<Response>;
type ApiRoute = Record<string, ApiHandler>;
// Initialize API code at Worker startup, outside the per-request CPU budget.
// React page rendering and the RSC router are not needed for REST requests.
const modules = import.meta.glob("../app/api/**/route.ts", { eager: true }) as unknown as Record<string, ApiRoute>;
const routes = Object.entries(modules).map(([file, module]) => {
  const segments = file.slice("../app".length, -"/route.ts".length).split("/").filter(Boolean);
  return { segments, module };
}).sort((a, b) => a.segments.filter(segment => segment.startsWith("[")).length - b.segments.filter(segment => segment.startsWith("[")).length);

export async function dispatchApi(request: Request): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  let segments: string[];
  try { segments = pathname.split("/").filter(Boolean).map(decodeURIComponent); }
  catch { return new Response("Bad request", { status: 400 }); }
  const params: Record<string, string> = {};
  const route = routes.find(route => route.segments.length === segments.length && route.segments.every((segment, index) => {
    if (segment.startsWith("[")) { params[segment.slice(1, -1)] = segments[index]; return true; }
    return segment === segments[index];
  }));
  if (!route) return new Response("Not found", { status: 404 });
  const method = request.method === "HEAD" ? "GET" : request.method;
  const handler = route.module[request.method] ?? route.module[method];
  const allow = Object.keys(route.module).filter(method => /^[A-Z]+$/.test(method));
  if (allow.includes("GET") && !allow.includes("HEAD")) allow.push("HEAD");
  if (!allow.includes("OPTIONS")) allow.push("OPTIONS");
  if (request.method === "OPTIONS" && !handler) return new Response(null, { status: 204, headers: { Allow: allow.join(", ") } });
  if (!handler) return new Response(null, { status: 405, headers: { Allow: allow.join(", ") } });

  let guestCookie: string | undefined;
  const headers = new Headers(request.headers);
  const cookies = (headers.get("cookie") ?? "").split(";").map(value => value.trim()).filter(Boolean);
  const current = cookies.find(value => value.startsWith(MEMBER_SESSION_COOKIE + "="))?.slice(MEMBER_SESSION_COOKIE.length + 1) ?? "";
  if (!GUEST_ID_PATTERN.test(current)) {
    const userId = "guest_" + crypto.randomUUID();
    headers.set("cookie", [...cookies.filter(value => !value.startsWith(MEMBER_SESSION_COOKIE + "=")), `${MEMBER_SESSION_COOKIE}=${userId}`].join("; "));
    guestCookie = `${MEMBER_SESSION_COOKIE}=${userId}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
  }
  const scopedRequest = new Request(request, { headers });
  return runWithHeadersContext(headersContextFromRequest(scopedRequest), async () => {
    setHeadersAccessPhase("route-handler");
    try {
      const response = await handler(scopedRequest, { params: Promise.resolve(params) });
      await discardUnreadBody(scopedRequest);
      const responseHeaders = new Headers(response.headers);
      for (const cookie of getAndClearPendingCookies()) responseHeaders.append("Set-Cookie", cookie);
      if (guestCookie) responseHeaders.append("Set-Cookie", guestCookie);
      // API data may contain identity, wallet or private records. Never let a
      // shared cache turn the cheap dispatcher into an authentication bypass.
      if (!responseHeaders.has("Cache-Control")) responseHeaders.set("Cache-Control", "private, no-store");
      return new Response(request.method === "HEAD" ? null : response.body, { status: response.status, headers: responseHeaders });
    } catch (error) {
      await discardUnreadBody(scopedRequest);
      console.error("API request failed", pathname, error instanceof Error ? error.message : "Unknown error");
      return Response.json({ error: "Chưa thể xử lý yêu cầu." }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
    }
  });
}
