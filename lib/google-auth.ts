import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { websiteAccounts } from "@/db/schema";
import { assertActiveMember } from "@/lib/member-account-status";
import { hashToken } from "@/lib/password";
import { AuthFlowError, limitAuthAttempts, requestIp } from "@/lib/auth-security";
import { createWebsiteSession } from "@/lib/auth-sessions";
import { safeAuthReturn, validOrigin } from "@/lib/website-auth";
import { googleAuthorizationUrl, GOOGLE_TOKEN_URL, verifyGoogleIdToken } from "@/lib/google-oauth";
import { googleKeyCache } from "@/lib/google-key-cache";

const GOOGLE_COOKIE = "tipook_google_login";
const TEN_MINUTES = 600_000;
type PendingLogin = { verifier: string; nonce: string; redirect_to: string };

function googleConfig(request: Request) {
  const bindings = env as unknown as Record<string, string | undefined>;
  const clientId = bindings.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = bindings.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new AuthFlowError("Đăng nhập Google chưa được cấu hình. Vui lòng dùng tên đăng nhập và mật khẩu.", 503);
  return { clientId, clientSecret, redirectUri: new URL("/api/auth/google/callback", request.url).toString() };
}
function googleCookie(value: string, request: Request, maxAge = 600) {
  return `${GOOGLE_COOKIE}=${value}; Path=/api/auth/google; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
function loginError(request: Request, message: string, returnTo?: string) {
  const url = new URL("/dang-nhap", request.url);
  url.searchParams.set("auth_error", message);
  // Keep the login form visible even when another account is still signed in.
  url.searchParams.set("add_account", "1");
  if (returnTo) url.searchParams.set("return_to", safeAuthReturn(returnTo));
  return new Response(null, { status: 303, headers: { Location: url.pathname + url.search, "Cache-Control": "no-store", "Set-Cookie": googleCookie("", request, 0) } });
}

export async function beginGoogleLogin(request: Request) {
  const returnTo = safeAuthReturn(new URL(request.url).searchParams.get("return_to"));
  try {
    if (!validOrigin(request)) throw new AuthFlowError("Nguồn yêu cầu không hợp lệ.", 403);
    const config = googleConfig(request);
    await limitAuthAttempts(`google-start:${requestIp(request)}`, 20);
    const state = randomBytes(32).toString("hex"), browser = randomBytes(32).toString("hex");
    const verifier = randomBytes(32).toString("base64url"), nonce = randomBytes(32).toString("hex");
    const previous = (await cookies()).get(GOOGLE_COOKIE)?.value || "";
    await env.DB!.batch([
      env.DB!.prepare("DELETE FROM auth_google_requests WHERE expires_at <= ? OR browser_hash = ?").bind(Date.now(), hashToken(previous)),
      env.DB!.prepare("INSERT INTO auth_google_requests (state_hash, browser_hash, verifier, nonce, redirect_to, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(hashToken(state), hashToken(browser), verifier, nonce, returnTo, Date.now() + TEN_MINUTES),
    ]);
    return new Response(null, { status: 303, headers: { Location: googleAuthorizationUrl(config.clientId, config.redirectUri, state, verifier, nonce), "Cache-Control": "no-store", "Set-Cookie": googleCookie(browser, request) } });
  } catch (error) {
    return loginError(request, error instanceof AuthFlowError ? error.message : "Chưa thể đăng nhập Google. Vui lòng thử lại.", returnTo);
  }
}

export async function completeGoogleLogin(request: Request) {
  let returnTo: string | undefined;
  try {
    const config = googleConfig(request);
    const params = new URL(request.url).searchParams;
    const state = params.get("state") || "", browser = (await cookies()).get(GOOGLE_COOKIE)?.value || "";
    if (!/^[a-f0-9]{64}$/.test(state) || !/^[a-f0-9]{64}$/.test(browser)) throw new AuthFlowError("Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.");
    await limitAuthAttempts(`google-callback:${requestIp(request)}`, 60);
    // Consume once, before contacting Google. State is bound to this browser.
    const pending = await env.DB!.prepare("DELETE FROM auth_google_requests WHERE state_hash = ? AND browser_hash = ? AND expires_at > ? RETURNING verifier, nonce, redirect_to")
      .bind(hashToken(state), hashToken(browser), Date.now()).first<PendingLogin>();
    if (!pending) throw new AuthFlowError("Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.");
    returnTo = pending.redirect_to;
    if (params.has("error")) throw new AuthFlowError("Bạn đã hủy hoặc chưa cho phép đăng nhập Google.");
    const code = params.get("code") || "";
    if (!code || code.length > 4096) throw new AuthFlowError("Không nhận được mã đăng nhập Google. Vui lòng thử lại.");
    const [tokenResponse, initialKeys] = await Promise.all([
      fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: "authorization_code", code_verifier: pending.verifier }), signal: AbortSignal.timeout(10000) }),
      googleKeyCache.get(),
    ]);
    if (!tokenResponse.ok) throw new AuthFlowError("Google chưa thể xác nhận đăng nhập. Vui lòng thử lại.");
    const tokens = await tokenResponse.json() as { id_token?: unknown };
    if (typeof tokens.id_token !== "string") throw new AuthFlowError("Google chưa thể xác nhận đăng nhập. Vui lòng thử lại.");
    const profile = await verifyGoogleIdToken(tokens.id_token, config.clientId, pending.nonce, await googleKeyCache.forToken(tokens.id_token, initialKeys));
    const db = getDb();
    let [account] = await db.select().from(websiteAccounts).where(eq(websiteAccounts.googleSub, profile.sub)).limit(1);
    const ownerEmail = (env as unknown as Record<string, string | undefined>).TIPOOK_ADMIN_EMAIL?.trim().toLowerCase();
    if (account?.isOwner || profile.email === ownerEmail) throw new AuthFlowError("Tài khoản quản trị cần đăng nhập bằng mật khẩu và ứng dụng xác thực.", 403);
    if (!account) {
      // Never link by an unverified local email. Existing accounts require their
      // password; a matching Google address cannot silently claim their data.
      const [existing] = await db.select({ userId: websiteAccounts.userId }).from(websiteAccounts).where(eq(websiteAccounts.email, profile.email)).limit(1);
      if (existing) throw new AuthFlowError("Email này đã có tài khoản. Vui lòng đăng nhập bằng email và mật khẩu đã đăng ký.", 409);
      [account] = await db.insert(websiteAccounts).values({ userId: "member_" + crypto.randomUUID(), email: profile.email, googleSub: profile.sub,
        displayName: profile.name?.trim().slice(0, 80) || profile.email.split("@")[0], passwordHash: "google-only:" + randomBytes(32).toString("hex"), createdAt: new Date().toISOString() }).onConflictDoNothing().returning();
      if (!account) [account] = await db.select().from(websiteAccounts).where(eq(websiteAccounts.googleSub, profile.sub)).limit(1);
      if (!account) throw new AuthFlowError("Email này đã có tài khoản. Vui lòng đăng nhập bằng email và mật khẩu đã đăng ký.", 409);
    }
    await assertActiveMember(account.userId);
    const session = await createWebsiteSession(request, account, returnTo, false, null, profile.picture);
    const result = await session.json() as { redirectTo: string };
    const response = new Response(null, { status: 303, headers: session.headers });
    response.headers.set("Location", result.redirectTo);
    response.headers.append("Set-Cookie", googleCookie("", request, 0));
    return response;
  } catch (error) {
    return loginError(request, error instanceof AuthFlowError ? error.message : "Chưa thể đăng nhập Google. Vui lòng thử lại.", returnTo);
  }
}
