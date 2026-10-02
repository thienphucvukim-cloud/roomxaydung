import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { env, waitUntil } from "cloudflare:workers";
import { authEmailReady } from "@/lib/auth-email";
import { CHALLENGE_COOKIE, challengeCookie, consumeEmailChallenge, issueEmailChallenge } from "@/lib/auth-challenges";
import { AuthFlowError, limitAuthAttempts, requestIp } from "@/lib/auth-security";
import { hashPassword, hashToken } from "@/lib/password";
import { authCookie, isAdminIdentity } from "@/lib/website-auth";

const TEN_MINUTES = 600_000;
type ResetRequest = { id: string; email: string; browser_hash: string; attempts: number; expires_at: number };

export async function requestPasswordRecovery(request: Request, value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AuthFlowError("Vui lòng nhập địa chỉ email hợp lệ.");
  // These checks and the response are independent of whether the email exists.
  await limitAuthAttempts(`reset-request:${email}`, 5);
  await limitAuthAttempts(`reset-request-ip:${requestIp(request)}`, 20);
  if (!authEmailReady(request)) throw new AuthFlowError("Chưa cấu hình dịch vụ gửi mã khôi phục. Vui lòng liên hệ chủ website.", 503);
  const now = Date.now();
  const cooldown = await env.DB!.prepare("INSERT INTO auth_email_cooldowns (key, sent_at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET sent_at = excluded.sent_at WHERE sent_at <= ? RETURNING key")
    .bind(hashToken(`reset-request:${email}`), now, now - 60_000).first();
  if (!cooldown) throw new AuthFlowError("Vui lòng chờ 60 giây trước khi yêu cầu mã mới.", 429, 60);
  const previous = (await cookies()).get(CHALLENGE_COOKIE)?.value || "";
  const secret = /^[a-f0-9]{64}$/.test(previous) ? previous : randomBytes(32).toString("hex");
  const id = randomBytes(32).toString("hex");
  const browserHash = hashToken(secret);
  await env.DB!.batch([
    env.DB!.prepare("DELETE FROM auth_password_reset_requests WHERE expires_at <= ? OR (email = ? AND browser_hash = ?)").bind(now, email, browserHash),
    env.DB!.prepare("INSERT INTO auth_password_reset_requests (id, email, browser_hash, attempts, created_at, expires_at) VALUES (?, ?, ?, 0, ?, ?)").bind(id, email, browserHash, now, now + TEN_MINUTES),
  ]);
  // Account lookup and email delivery happen after returning a uniform response.
  // Recovery never creates an account, changes its password or grants a session.
  waitUntil(deliverRecoveryEmail(request, email, id, secret).catch(() => {
    // Do not log email addresses, codes, passwords or provider responses.
    console.error("Password recovery email could not be processed.");
  }));
  const [name, domain] = email.split("@");
  return Response.json({ requiresCode: true, challengeId: id, emailMasked: `${name[0]}***@${domain}`, expiresAt: now + TEN_MINUTES, resendAfter: 60,
    message: "Nếu email đã có tài khoản, bạn sẽ nhận được mã khôi phục. Kiểm tra cả mục thư rác." },
  { headers: { "Cache-Control": "no-store", "Set-Cookie": challengeCookie(secret, request) } });
}

async function deliverRecoveryEmail(request: Request, email: string, id: string, secret: string) {
  const row = await env.DB!.prepare("SELECT user_id AS userId, email, password_hash AS passwordHash, is_owner AS isOwner FROM website_accounts WHERE email = ? AND NOT EXISTS (SELECT 1 FROM member_profiles WHERE user_id = website_accounts.user_id AND account_status != 'active')")
    .bind(email).first<{ userId: string; email: string; passwordHash: string; isOwner: number }>();
  if (!row) return;
  const account = { ...row, isOwner: row.isOwner === 1 };
  if (account.isOwner) return; // Admin recovery requires a one-use offline recovery code.
  const configuredOwner = (env as unknown as Record<string, string | undefined>).TIPOOK_ADMIN_EMAIL?.trim().toLowerCase();
  // An ordinary account registered before owner configuration cannot recover
  // the reserved owner address or acquire owner access through password reset.
  if ((account.isOwner && !isAdminIdentity(account)) || (!account.isOwner && account.email === configuredOwner)) return;
  const pending = await env.DB!.prepare("SELECT id FROM auth_password_reset_requests WHERE id = ? AND browser_hash = ? AND expires_at > ?")
    .bind(id, hashToken(secret), Date.now()).first();
  if (pending) await issueEmailChallenge(request, account, "reset", "/dang-nhap", null, null, { id, secret });
}

export async function resetForgottenPassword(request: Request, body: Record<string, unknown>) {
  const password = typeof body.newPassword === "string" ? body.newPassword : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (password.length < 6 || password.length > 128) throw new AuthFlowError("Mật khẩu mới cần từ 6 đến 128 ký tự.");
  if (!/^\d{6}$/.test(code)) throw new AuthFlowError("Vui lòng nhập mã xác nhận gồm 6 chữ số.");
  await limitAuthAttempts(`reset-verify-ip:${requestIp(request)}`, 60);
  const secret = (await cookies()).get(CHALLENGE_COOKIE)?.value || "";
  const id = typeof body.challengeId === "string" ? body.challengeId : "";
  if (!/^[a-f0-9]{64}$/.test(id) || !/^[a-f0-9]{64}$/.test(secret)) throw new AuthFlowError("Mã khôi phục không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu mã mới.");
  const pending = await env.DB!.prepare("UPDATE auth_password_reset_requests SET attempts = attempts + 1 WHERE id = ? AND browser_hash = ? AND expires_at > ? AND attempts < 5 RETURNING *")
    .bind(id, hashToken(secret), Date.now()).first<ResetRequest>();
  if (!pending) throw new AuthFlowError("Mã khôi phục đã hết hạn, đã dùng hoặc vượt số lần thử. Vui lòng yêu cầu mã mới.");
  await limitAuthAttempts(`reset-verify:${pending.email}`, 15);
  let result: Awaited<ReturnType<typeof consumeEmailChallenge>>;
  try { result = await consumeEmailChallenge(request, id, code, "reset"); }
  catch (error) {
    if (error instanceof AuthFlowError && error.status !== 429) throw new AuthFlowError("Mã khôi phục không đúng, đã hết hạn hoặc đã dùng. Vui lòng kiểm tra mã hoặc yêu cầu mã mới.");
    throw error;
  }
  if (result.account.email !== pending.email) throw new AuthFlowError("Yêu cầu khôi phục không hợp lệ.");
  const passwordHash = await hashPassword(password);
  // Conditional writes protect against a password change in another request.
  // A D1 batch atomically changes the password and revokes sessions/challenges.
  const updated = await env.DB!.batch([
    env.DB!.prepare("UPDATE website_accounts SET password_hash = ? WHERE user_id = ? AND password_hash = ? AND NOT EXISTS (SELECT 1 FROM member_profiles WHERE user_id = website_accounts.user_id AND account_status != 'active') AND EXISTS (SELECT 1 FROM auth_password_reset_requests WHERE id = ? AND browser_hash = ? AND expires_at > ?) RETURNING user_id")
      .bind(passwordHash, result.account.userId, result.account.passwordHash, id, hashToken(secret), Date.now()),
    env.DB!.prepare("DELETE FROM website_sessions WHERE user_id = ? AND EXISTS (SELECT 1 FROM website_accounts WHERE user_id = ? AND password_hash = ?)").bind(result.account.userId, result.account.userId, passwordHash),
    env.DB!.prepare("DELETE FROM auth_email_challenges WHERE user_id = ? AND EXISTS (SELECT 1 FROM website_accounts WHERE user_id = ? AND password_hash = ?)").bind(result.account.userId, result.account.userId, passwordHash),
    env.DB!.prepare("DELETE FROM auth_password_reset_requests WHERE email = ? AND EXISTS (SELECT 1 FROM website_accounts WHERE user_id = ? AND password_hash = ?)").bind(result.account.email, result.account.userId, passwordHash),
  ]);
  if (!updated[0].results.length) throw new AuthFlowError("Tài khoản đã thay đổi. Vui lòng yêu cầu mã mới.", 400);
  const response = Response.json({ ok: true, passwordReset: true }, { headers: { "Cache-Control": "no-store" } });
  response.headers.append("Set-Cookie", authCookie("", request, 0));
  response.headers.append("Set-Cookie", challengeCookie("", request, 0));
  return response;
}
