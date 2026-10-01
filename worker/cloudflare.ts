import handler from "vinext/server/fetch-handler";
import { cloudflareRequest } from "../lib/cloudflare-request";

const worker = {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    // ChatGPT sign-in belongs to the Sites control plane. Standalone Cloudflare
    // needs its own identity provider before authenticated login can be enabled.
    const pathname = new URL(request.url).pathname;
    if (["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"].includes(pathname)) {
      return new Response("Đăng nhập chưa được cấu hình trên Cloudflare.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
    return handler.fetch(cloudflareRequest(request), env, ctx);
  },
};

export default worker;
