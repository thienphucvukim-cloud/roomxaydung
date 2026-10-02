import { env } from "cloudflare:workers";

// This option is compiled out of production and only accepts loopback requests.
export function localAdminPasswordOnly(request: Request) {
  return import.meta.env?.DEV === true
    && (env as unknown as Record<string, string | undefined>).TIPOOK_LOCAL_ADMIN_PASSWORD_ONLY === "1"
    && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname);
}
