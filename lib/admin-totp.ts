import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "cloudflare:workers";
import { AUTH_COOKIE, authCookie, getAuthenticatedIdentity, isAdminIdentity, safeAuthReturn } from "@/lib/website-auth";
import { hashPassword, hashToken, verifyPassword } from "@/lib/password";
import { AuthFlowError, limitAuthAttempts, requestIp } from "@/lib/auth-security";
import { createWebsiteSession } from "@/lib/auth-sessions";
import { decryptTotpSecret, encryptTotpSecret, matchingTotpStep, newRecoveryCodes, newTotpSecret, recoveryCodeHash } from "@/lib/totp-crypto";

export const TOTP_COOKIE = "tipook_totp_challenge";
type Account = { userId: string; email: string; displayName: string; passwordHash: string; isOwner: boolean };
type Credential = { secret_encrypted: string; last_step: number };
type Challenge = { id: string; user_id: string; purpose: "login" | "setup" | "password" | "rotate"; browser_hash: string; password_version: string; credential_version: string | null; pending_secret: string | null; new_password_hash: string | null; session_hash: string | null; redirect_to: string; attempts: number; expires_at: number };
export function adminTotpReady() { return /^[a-f0-9]{64}$/.test((env as unknown as Record<string, string>).TIPOOK_MFA_KEY || ""); }
function encryptionKey() {
  if (!adminTotpReady()) throw new AuthFlowError("Chưa cấu hình khóa bảo mật quản trị trên máy chủ.", 503);
  return (env as unknown as Record<string, string>).TIPOOK_MFA_KEY;
}
export function totpCookie(value: string, request: Request, maxAge = 600) {
  return `${TOTP_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
async function credential(userId: string) {
  return env.DB!.prepare("SELECT secret_encrypted, last_step FROM admin_totp_credentials WHERE user_id = ?").bind(userId).first<Credential>();
}
async function accountByEmail(email: string) {
  const row = await env.DB!.prepare("SELECT user_id AS userId, email, display_name AS displayName, password_hash AS passwordHash, is_owner AS isOwner FROM website_accounts WHERE email = ?").bind(email).first<Omit<Account, "isOwner"> & { isOwner: number }>();
  return row ? { ...row, isOwner: row.isOwner === 1 } : null;
}
export async function issueTotpChallenge(request: Request, account: Account, purpose: "login" | "password" | "rotate", redirectTo: string, newPasswordHash: string | null = null, sessionHash: string | null = null) {
  const key = encryptionKey();
  if (!account.isOwner || !isAdminIdentity(account)) throw new AuthFlowError("Tài khoản không có quyền quản trị.", 403);
  await limitAuthAttempts(`totp-start:${account.userId}`, 20);
  const current = await credential(account.userId);
  if (!current && purpose !== "login") throw new AuthFlowError("Hãy đăng nhập và thiết lập ứng dụng xác thực trước.", 403);
  const actualPurpose = !current ? "setup" : purpose;
  const setup = actualPurpose === "setup" || actualPurpose === "rotate";
  const seed = setup ? newTotpSecret() : null;
  const browser = randomBytes(32).toString("hex"), id = randomBytes(32).toString("hex"), expires = Date.now() + 600_000;
  const previous = (await cookies()).get(TOTP_COOKIE)?.value;
  await env.DB!.batch([
    env.DB!.prepare("DELETE FROM admin_totp_challenges WHERE expires_at <= ? OR browser_hash = ?").bind(Date.now(), hashToken(previous || "")),
    env.DB!.prepare("INSERT INTO admin_totp_challenges (id, user_id, purpose, browser_hash, password_version, credential_version, pending_secret, new_password_hash, session_hash, redirect_to, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, account.userId, actualPurpose, hashToken(browser), hashToken(account.passwordHash), current?.secret_encrypted || null, seed ? encryptTotpSecret(seed, key, account.userId) : null, newPasswordHash, sessionHash, safeAuthReturn(redirectTo), expires),
  ]);
  return Response.json({ requiresCode: true, method: "totp", challengeId: id, expiresAt: expires, setupRequired: setup,
    ...(seed ? { setupSecret: seed, setupUri: `otpauth://totp/${encodeURIComponent(`Tipook:${account.email}`)}?secret=${seed}&issuer=Tipook&algorithm=SHA1&digits=6&period=30` } : {}) },
  { headers: { "Cache-Control": "private, no-store", "Set-Cookie": totpCookie(browser, request) } });
}
async function consumeFactor(account: Account, current: Credential, value: unknown, recovery: boolean) {
  const code = typeof value === "string" ? value.trim() : "";
  if (recovery) {
    const hash = recoveryCodeHash(account.userId, code);
    if (!hash) throw new AuthFlowError("Mã khôi phục không hợp lệ hoặc đã dùng.");
    const used = await env.DB!.prepare("DELETE FROM admin_recovery_codes WHERE code_hash = ? AND user_id = ? AND EXISTS (SELECT 1 FROM admin_totp_credentials WHERE user_id = ? AND secret_encrypted = ?) AND EXISTS (SELECT 1 FROM website_accounts WHERE user_id = ? AND password_hash = ?) RETURNING code_hash")
      .bind(hash, account.userId, account.userId, current.secret_encrypted, account.userId, account.passwordHash).first();
    if (!used) throw new AuthFlowError("Mã khôi phục không hợp lệ hoặc đã dùng.");
    return;
  }
  const step = matchingTotpStep(decryptTotpSecret(current.secret_encrypted, encryptionKey(), account.userId), code);
  if (step === null) throw new AuthFlowError("Mã xác thực không đúng. Kiểm tra giờ trên điện thoại và thử lại.");
  const used = await env.DB!.prepare("UPDATE admin_totp_credentials SET last_step = ? WHERE user_id = ? AND secret_encrypted = ? AND last_step < ? AND EXISTS (SELECT 1 FROM website_accounts WHERE user_id = ? AND password_hash = ?) RETURNING user_id")
    .bind(step, account.userId, current.secret_encrypted, step, account.userId, account.passwordHash).first();
  if (!used) throw new AuthFlowError("Mã đã dùng hoặc thiết bị đã thay đổi. Chờ mã mới rồi thử lại.");
}
export async function verifyTotpChallenge(request: Request, body: Record<string, unknown>) {
  encryptionKey();
  await limitAuthAttempts(`totp-verify-ip:${requestIp(request)}`, 60);
  const browser = (await cookies()).get(TOTP_COOKIE)?.value || "";
  const id = typeof body.challengeId === "string" ? body.challengeId : "";
  if (!/^[a-f0-9]{64}$/.test(id) || !/^[a-f0-9]{64}$/.test(browser)) throw new AuthFlowError("Yêu cầu xác thực không hợp lệ. Hãy đăng nhập lại.");
  const challenge = await env.DB!.prepare("UPDATE admin_totp_challenges SET attempts = attempts + 1 WHERE id = ? AND browser_hash = ? AND expires_at > ? AND attempts < 5 RETURNING *")
    .bind(id, hashToken(browser), Date.now()).first<Challenge>();
  if (!challenge) throw new AuthFlowError("Yêu cầu đã hết hạn hoặc vượt 5 lần thử. Hãy đăng nhập lại.");
  await limitAuthAttempts(`totp-verify:${challenge.user_id}`, 15);
  const row = await env.DB!.prepare("SELECT email FROM website_accounts WHERE user_id = ?").bind(challenge.user_id).first<{ email: string }>();
  const account = row ? await accountByEmail(row.email) : null;
  if (!account?.isOwner || !isAdminIdentity(account) || hashToken(account.passwordHash) !== challenge.password_version) throw new AuthFlowError("Tài khoản đã thay đổi. Hãy đăng nhập lại.", 401);
  const current = await credential(account.userId);
  if ((current?.secret_encrypted || null) !== challenge.credential_version) throw new AuthFlowError("Thiết bị xác thực đã thay đổi. Hãy đăng nhập lại.", 401);
  if (challenge.session_hash) {
    const token = (await cookies()).get(AUTH_COOKIE)?.value || "";
    const session = await env.DB!.prepare("SELECT token_hash FROM website_sessions WHERE token_hash = ? AND user_id = ? AND expires_at > ? AND owner_verified = 1").bind(hashToken(token), account.userId, Date.now()).first();
    if (!session || hashToken(token) !== challenge.session_hash) throw new AuthFlowError("Phiên đã hết hạn. Hãy đăng nhập lại.", 401);
  }
  let step: number | null = null;
  if (challenge.pending_secret) {
    step = matchingTotpStep(decryptTotpSecret(challenge.pending_secret, encryptionKey(), account.userId), typeof body.code === "string" ? body.code.trim() : "");
    if (step === null || body.recovery === true) throw new AuthFlowError("Nhập mã 6 chữ số từ ứng dụng vừa thiết lập.");
  } else {
    if (!current) throw new AuthFlowError("Thiết bị xác thực chưa được thiết lập.", 403);
    await consumeFactor(account, current, body.code, body.recovery === true);
  }
  const consumed = await env.DB!.prepare("DELETE FROM admin_totp_challenges WHERE id = ? AND browser_hash = ? AND expires_at > ? RETURNING id").bind(id, hashToken(browser), Date.now()).first();
  if (!consumed) throw new AuthFlowError("Yêu cầu đã dùng. Hãy đăng nhập lại.");
  let response: Response;
  if (challenge.pending_secret && step !== null) {
    const seed = challenge.pending_secret, codes = newRecoveryCodes();
    const write = challenge.purpose === "setup"
      ? env.DB!.prepare("INSERT INTO admin_totp_credentials (user_id, secret_encrypted, last_step, created_at) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM website_accounts WHERE user_id = ? AND password_hash = ?) ON CONFLICT(user_id) DO NOTHING RETURNING user_id")
        .bind(account.userId, seed, step, Date.now(), account.userId, account.passwordHash)
      : env.DB!.prepare("UPDATE admin_totp_credentials SET secret_encrypted = ?, last_step = ?, created_at = ? WHERE user_id = ? AND secret_encrypted = ? AND EXISTS (SELECT 1 FROM website_accounts WHERE user_id = ? AND password_hash = ?) AND EXISTS (SELECT 1 FROM website_sessions WHERE token_hash = ? AND user_id = ? AND expires_at > ? AND owner_verified = 1) RETURNING user_id")
        .bind(seed, step, Date.now(), account.userId, current!.secret_encrypted, account.userId, account.passwordHash, challenge.session_hash, account.userId, Date.now());
    const results = await env.DB!.batch([
      write,
      env.DB!.prepare("DELETE FROM admin_recovery_codes WHERE user_id = ? AND EXISTS (SELECT 1 FROM admin_totp_credentials WHERE user_id = ? AND secret_encrypted = ?)").bind(account.userId, account.userId, seed),
      ...codes.map(code => env.DB!.prepare("INSERT INTO admin_recovery_codes (code_hash, user_id) SELECT ?, ? WHERE EXISTS (SELECT 1 FROM admin_totp_credentials WHERE user_id = ? AND secret_encrypted = ?)").bind(recoveryCodeHash(account.userId, code), account.userId, account.userId, seed)),
      env.DB!.prepare("DELETE FROM website_sessions WHERE user_id = ? AND token_hash != ? AND EXISTS (SELECT 1 FROM admin_totp_credentials WHERE user_id = ? AND secret_encrypted = ?)").bind(account.userId, challenge.session_hash || "", account.userId, seed),
      env.DB!.prepare("DELETE FROM admin_totp_challenges WHERE user_id = ? AND EXISTS (SELECT 1 FROM admin_totp_credentials WHERE user_id = ? AND secret_encrypted = ?)").bind(account.userId, account.userId, seed),
    ]);
    if (!results[0].results.length) throw new AuthFlowError("Thiết lập đã thay đổi ở phiên khác. Hãy đăng nhập lại.", 409);
    if (challenge.purpose === "setup") {
      const session = await createWebsiteSession(request, account, challenge.redirect_to, true, seed);
      const result = await session.json() as Record<string, unknown>;
      response = Response.json({ ...result, recoveryCodes: codes }, { headers: session.headers });
    } else response = Response.json({ ok: true, recoveryCodes: codes, deviceChanged: true }, { headers: { "Cache-Control": "no-store" } });
  } else if (challenge.purpose === "password") {
    if (!challenge.new_password_hash) throw new AuthFlowError("Yêu cầu đổi mật khẩu không hợp lệ.");
    const nextHash = challenge.new_password_hash;
    const results = await env.DB!.batch([
      env.DB!.prepare("UPDATE website_accounts SET password_hash = ? WHERE user_id = ? AND password_hash = ? AND EXISTS (SELECT 1 FROM admin_totp_credentials WHERE user_id = ? AND secret_encrypted = ?) AND EXISTS (SELECT 1 FROM website_sessions WHERE token_hash = ? AND user_id = ? AND expires_at > ? AND owner_verified = 1) RETURNING user_id").bind(nextHash, account.userId, account.passwordHash, account.userId, current!.secret_encrypted, challenge.session_hash, account.userId, Date.now()),
      env.DB!.prepare("DELETE FROM website_sessions WHERE user_id = ? AND token_hash != ? AND EXISTS (SELECT 1 FROM website_accounts WHERE user_id = ? AND password_hash = ?)").bind(account.userId, challenge.session_hash, account.userId, nextHash),
      env.DB!.prepare("DELETE FROM admin_totp_challenges WHERE user_id = ? AND EXISTS (SELECT 1 FROM website_accounts WHERE user_id = ? AND password_hash = ?)").bind(account.userId, account.userId, nextHash),
    ]);
    if (!results[0].results.length) throw new AuthFlowError("Tài khoản hoặc phiên đã thay đổi. Hãy đăng nhập lại.", 401);
    response = Response.json({ ok: true, passwordChanged: true }, { headers: { "Cache-Control": "no-store" } });
  } else response = await createWebsiteSession(request, account, challenge.redirect_to, true, current!.secret_encrypted);
  response.headers.append("Set-Cookie", totpCookie("", request, 0));
  return response;
}
export async function beginTotpRotation(request: Request, body: Record<string, unknown>) {
  const identity = await getAuthenticatedIdentity();
  if (identity?.source !== "website" || !isAdminIdentity(identity)) throw new AuthFlowError("Hãy đăng nhập quản trị trước.", 403);
  await limitAuthAttempts(`totp-rotate:${identity.userId}`, 5);
  const account = await accountByEmail(identity.email), current = account ? await credential(account.userId) : null;
  if (!account || !current || typeof body.password !== "string" || body.password.length > 128 || !await verifyPassword(body.password, account.passwordHash)) throw new AuthFlowError("Mật khẩu hiện tại không đúng.");
  await consumeFactor(account, current, body.code, body.recovery === true);
  const token = (await cookies()).get(AUTH_COOKIE)?.value || "";
  return issueTotpChallenge(request, account, "rotate", "/tai-khoan", null, hashToken(token));
}
export async function recoverAdminPassword(request: Request, body: Record<string, unknown>) {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.newPassword === "string" ? body.newPassword : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 10 || password.length > 128) throw new AuthFlowError("Nhập email hợp lệ và mật khẩu mới từ 10 đến 128 ký tự.");
  await limitAuthAttempts(`admin-recover-ip:${requestIp(request)}`, 20);
  await limitAuthAttempts(`admin-recover:${email}`, 5);
  const account = await accountByEmail(email), current = account ? await credential(account.userId) : null;
  if (!account?.isOwner || !isAdminIdentity(account) || !current) throw new AuthFlowError("Email hoặc mã khôi phục không hợp lệ.");
  await consumeFactor(account, current, body.code, true);
  const nextHash = await hashPassword(password);
  const result = await env.DB!.batch([
    env.DB!.prepare("UPDATE website_accounts SET password_hash = ? WHERE user_id = ? AND password_hash = ? AND EXISTS (SELECT 1 FROM admin_totp_credentials WHERE user_id = ? AND secret_encrypted = ?) RETURNING user_id").bind(nextHash, account.userId, account.passwordHash, account.userId, current.secret_encrypted),
    env.DB!.prepare("DELETE FROM website_sessions WHERE user_id = ? AND EXISTS (SELECT 1 FROM website_accounts WHERE user_id = ? AND password_hash = ?)").bind(account.userId, account.userId, nextHash),
    env.DB!.prepare("DELETE FROM admin_totp_challenges WHERE user_id = ? AND EXISTS (SELECT 1 FROM website_accounts WHERE user_id = ? AND password_hash = ?)").bind(account.userId, account.userId, nextHash),
    env.DB!.prepare("DELETE FROM auth_email_challenges WHERE user_id = ? AND EXISTS (SELECT 1 FROM website_accounts WHERE user_id = ? AND password_hash = ?)").bind(account.userId, account.userId, nextHash),
  ]);
  if (!result[0].results.length) throw new AuthFlowError("Tài khoản đã thay đổi. Hãy thử lại.");
  const response = Response.json({ ok: true, passwordReset: true }, { headers: { "Cache-Control": "no-store" } });
  response.headers.append("Set-Cookie", authCookie("", request, 0)); response.headers.append("Set-Cookie", totpCookie("", request, 0));
  return response;
}
export async function cancelTotpChallenges() {
  const browser = (await cookies()).get(TOTP_COOKIE)?.value;
  if (browser) await env.DB!.prepare("DELETE FROM admin_totp_challenges WHERE browser_hash = ?").bind(hashToken(browser)).run();
}
