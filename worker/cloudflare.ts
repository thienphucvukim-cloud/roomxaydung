import { cloudflareRequest } from "../lib/cloudflare-request";
import { readPublicFile } from "../lib/public-file";
import { AUTH_COOKIE } from "../lib/session-cookie";
import { dispatchApi } from "./api-router";
import { shellAssetPath, STATIC_SHELL_PATHS, STATIC_SHELL_TEMPLATES } from "../lib/static-shells";
import { handleConfiguredImageOptimization, isImageOptimizationPath } from "vinext/server/image-optimization";
import { canonicalUrl, isPublicSeoPage, isSitemapPath } from "../lib/seo";
import { robotsResponse } from "../lib/seo-robots";
export { ApiRuntime } from "./api-runtime";

let shellVersion: { buildId: string; rscCompatibilityId: string } | undefined;
async function getShellVersion(request: Request, assets: Fetcher) {
  if (!shellVersion) {
    const response = await assets.fetch(new Request(new URL("/_shells/version.json", request.url)));
    if (response.ok) shellVersion = await response.json();
  }
  return shellVersion;
}
async function canReuseRoot(request: Request, assets: Fetcher) {
  const raw = request.headers.get("x-vinext-client-reuse-manifest");
  if (!raw || raw.length > 16384) return false;
  try {
    const manifest = JSON.parse(raw) as { schemaVersion?: number; entries?: { id?: string; privacy?: string; artifactCompatibility?: { deploymentVersion?: string } }[] };
    if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.entries)) return false;
    const root = manifest.entries.find(entry => entry.id === "layout:/" && entry.privacy === "public");
    if (!root?.artifactCompatibility?.deploymentVersion) return false;
    const version = await getShellVersion(request, assets);
    if (!version) return false;
    return root.artifactCompatibility.deploymentVersion === version.buildId ? true : "stale";
  } catch { return false; }
}

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    // ChatGPT sign-in belongs to the Sites control plane. Standalone Cloudflare
    // needs its own identity provider before authenticated login can be enabled.
    const pathname = new URL(request.url).pathname;
    const readOnly = request.method === "GET" || request.method === "HEAD";
    if (readOnly && pathname === "/robots.txt") return robotsResponse(request.method);
    if (readOnly) {
      const url = new URL(request.url);
      if (pathname.length > 1 && pathname.endsWith("/")) {
        return new Response(null, { status: 308, headers: { Location: pathname.replace(/\/+$/, "") + url.search } });
      }
      const aliases: Record<string, string> = {
        "/bang-tin": "/", "/kho-mau-nha-dep-tipook": "/kho-mau-nha-dep-chat",
        "/file-ban-ve-nha-dep-tipook": "/file-ban-ve-nha-dep-chat", "/tinh-vat-tu-tipook": "/tinh-vat-tu-nha-dep-chat",
      };
      const fixedRedirects: Record<string, string> = {
        "/nha-thau-thi-cong": "/file-ban-ve-nha-dep-chat", "/viec-lam": "/tinh-vat-tu-nha-dep-chat",
        "/quan-tri": "/kho-mau-nha-dep-chat?quan-ly=noi-dung", "/quan-tri/nap-tien": "/tai-khoan?quan-ly=giao-dich",
      };
      if (aliases[pathname]) return new Response(null, { status: 308, headers: { Location: aliases[pathname] + url.search } });
      if (fixedRedirects[pathname]) return new Response(null, { status: 307, headers: { Location: fixedRedirects[pathname] } });
      const pagination = pathname.match(/^\/(kho-mau-nha-dep-(?:chat|tipook)|file-ban-ve-nha-dep-(?:chat|tipook)|noi-that)\/page\/([^/]+)$/);
      if (pagination) {
        const [, section, page] = pagination;
        if (!/^[1-9]\d*$/.test(page) || Number(page) > 1000000) return new Response("Not found", { status: 404 });
        url.pathname = "/" + section.replace(/tipook$/, "chat");
        url.searchParams.delete("_rsc");
        if (!section.startsWith("kho-mau") && Number(page) > 1) url.searchParams.set("page", page);
        else url.searchParams.delete("page");
        return new Response(null, { status: 308, headers: { Location: url.pathname + url.search } });
      }
    }
    // Keep frequent image reads out of the RSC router and its cold imports.
    if (readOnly && pathname === "/api/files") {
      return readPublicFile(request, env.BUCKET);
    }
    if (readOnly && isImageOptimizationPath(pathname)) {
      const response = await handleConfiguredImageOptimization(request, async imagePath => {
        const url = new URL(imagePath, request.url);
        if (url.pathname === "/api/files") return readPublicFile(new Request(url), env.BUCKET);
        if (url.pathname.startsWith("/api/") || !env.ASSETS) return new Response(null, { status: 404 });
        return env.ASSETS.fetch(new Request(url));
      });
      return request.method === "HEAD" ? new Response(null, { status: response.status, headers: response.headers }) : response;
    }
    // Standalone Cloudflare never trusts Sites headers. An anonymous profile
    // needs neither framework initialization nor a D1 lookup.
    if (request.method === "GET" && pathname === "/api/me"
      && !(request.headers.get("cookie") ?? "").split(";").some(value => value.trim().startsWith(AUTH_COOKIE + "="))) {
      return Response.json({ user: null, counts: { posts: 0, actions: 0, requests: 0 } }, { headers: { "Cache-Control": "private, no-store" } });
    }
    // Scanner URLs in production logs previously rendered a full React 404.
    if (/^\/(?:wp-admin|wp-includes|wp-content)(?:\/|$)/.test(pathname)
      || /^\/(?:wp-login|xmlrpc)\.php$/.test(pathname)) {
      return new Response("Not found", { status: 404 });
    }
    if (readOnly && pathname === "/favicon.ico") {
      return new Response(null, { status: 302, headers: { Location: "/nhadepchat-browser-icon.png?v=4" } });
    }
    if (["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"].includes(pathname)) {
      return new Response("Đăng nhập chưa được cấu hình trên Cloudflare.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
    if (pathname.startsWith("/api/")) {
      const sanitized = cloudflareRequest(request);
      if (env.API_RUNTIME) {
        const shard = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
        return env.API_RUNTIME.get(env.API_RUNTIME.idFromName("api-" + shard)).fetch(sanitized);
      }
      return dispatchApi(sanitized);
    }
    if (readOnly && env.API_RUNTIME && (isPublicSeoPage(pathname) || isSitemapPath(pathname))) {
      // A dedicated named shard isolates public page rendering from auth and
      // uploads without adding a binding, migration or paid resource.
      const headers = new Headers(request.headers);
      headers.delete("cookie"); headers.delete("authorization");
      return env.API_RUNTIME.get(env.API_RUNTIME.idFromName("public-pages")).fetch(cloudflareRequest(new Request(request, { headers })));
    }
    const template = STATIC_SHELL_TEMPLATES.find(template => pathname.startsWith(template.prefix) && /^[A-Za-z0-9_-]{1,180}$/.test(pathname.slice(template.prefix.length)));
    const detailId = template ? pathname.slice(template.prefix.length) : undefined;
    if (template?.numeric && (!/^[1-9]\d*$/.test(detailId!) || !Number.isSafeInteger(Number(detailId)))) return new Response("Not found", { status: 404 });
    if (readOnly && env.ASSETS && (template || STATIC_SHELL_PATHS.some(path => path === pathname))) {
      const url = new URL(request.url);
      {
        const rsc = request.headers.get("rsc") === "1";
        const reuse = rsc ? await canReuseRoot(request, env.ASSETS) : false;
        // A client retaining an older build must reload its document/manifest
        // before decoding references to newly compiled client modules.
        if (reuse === "stale") return new Response(null, { status: 409, headers: { "Cache-Control": "no-store" } });
        url.pathname = shellAssetPath(template ? template.prefix + template.marker : pathname, rsc, reuse === true);
        url.search = "";
        const response = await env.ASSETS.fetch(new Request(url, { method: request.method }));
        if (response.ok) {
          const headers = new Headers(response.headers);
          headers.set("Content-Type", rsc ? "text/x-component; charset=utf-8" : "text/html; charset=utf-8");
          if (rsc) {
            const version = await getShellVersion(request, env.ASSETS);
            if (version) headers.set("X-Vinext-RSC-Compatibility-Id", version.rscCompatibilityId);
          }
          headers.set("Cache-Control", "public, max-age=0, must-revalidate");
          headers.set("Vary", "RSC, Next-Router-State-Tree, Next-Router-Prefetch, X-Vinext-Client-Reuse-Manifest");
          if (template) {
            headers.delete("etag");
            headers.delete("content-length");
            headers.delete("content-encoding");
            headers.set("X-Vinext-Params", encodeURIComponent(JSON.stringify({ id: detailId })));
            const body = (await response.text()).split(template.marker).join(detailId!);
            return new Response(request.method === "HEAD" ? null : body, { status: 200, headers });
          }
          return new Response(response.body, { status: response.status, headers });
        }
      }
    }
    if (env.ASSETS) {
      const response = await env.ASSETS.fetch(new Request(new URL("/_shells/not-found.html", request.url)));
      if (response.ok) return new Response(readOnly && request.method !== "HEAD" ? response.body : null, {
        status: readOnly ? 404 : 405, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
    const { default: handler } = await import("vinext/server/fetch-handler");
    return handler.fetch(cloudflareRequest(request), env, ctx);
  },
};

const seoWorker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const response = await worker.fetch(request, env, ctx);
    const url = new URL(request.url), headers = new Headers(response.headers);
    const contentType = headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      if (!isPublicSeoPage(url.pathname) || [...url.searchParams.keys()].some(key => !["_rsc", "page"].includes(key))) headers.set("X-Robots-Tag", "noindex, follow");
      if (isPublicSeoPage(url.pathname)) headers.set("Link", `<${canonicalUrl(url.pathname + url.search)}>; rel="canonical"`);
    } else if (url.pathname.startsWith("/api/") && url.pathname !== "/api/files") headers.set("X-Robots-Tag", "noindex");
    return new Response(response.body, { status: response.status, headers });
  },
};
export default seoWorker;
