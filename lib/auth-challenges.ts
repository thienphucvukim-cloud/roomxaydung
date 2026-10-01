import { randomBytes, randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "cloudflare:workers";
import { hashToken } from "@/lib/password";
import { authEmailReady, sendAuthEmail } from "@/lib/auth-email";
import { AuthFlowError, limitAuthAttempts, requestIp } from "@/lib/auth-security";
import { AUTH_COOKIE, isAdminIdentity } from "@/lib/website-auth";

export const CHALLENGE_COOKIE = "tipook_auth_challenge";
const TEN_MINUTES = 600_000;
type OwnerAccount = { userId: string; email: string; passwordHash: string };
export type EmailChallenge = {
  id: string; user_id: string; purpose: "login" | "password" | "reset"; browser_hash: string; code_hash: string;
  password_version: string; session_hash: string | null; new_password_hash: string | null; redirect_to: string;
  attempts: number; expires_at: number; created_at: number;
};
export function challengeCookie(value: string, request: Request, maxAge = 600) {
  return `${CHALLENGE_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
async function browserSecret() { return (await cookies()).get(CHALLENGE_COOKIE)?.value || ""; }
function codeHash(id: string, secret: string, code: string) { return hashToken(`${id}:${secret}:${code}`); }

export async function issueEmailChallenge(request: Request, account: OwnerAccount, purpose: EmailChallenge["purpose"], redirectTo: string, newPasswordHash: string | null = null, sessionHash: string | null = null, seed?: { id: string; secret: string }) {
  if (!authEmailReady(request)) throw new AuthFlowError("Chưa cấu hình dịch vụ gửi mã xác nhận. Vui lòng liên hệ chủ website.", 503);
  const now = Date.now();
  const cooldown = hashToken(`email:${account.userId}:${purpose}`);
  const reserved = await env.DB!.prepare("INSERT INTO auth_email_cooldowns (key, sent_at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET sent_at = excluded.sent_at WHERE sent_at <= ? RETURNING key")
    .bind(cooldown, now, now - 60_000).first();
  if (!reserved) throw new AuthFlowError("Vui lòng chờ 60 giây trước khi yêu cầu mã mới.", 429, 60);
  await limitAuthAttempts(`email-send:${account.userId}${purpose === "reset" ? ":reset" : ""}`, 5);
  await limitAuthAttempts(`email-send-ip:${requestIp(request)}${purpose === "reset" ? ":reset" : ""}`, 20);
  const previousSecret = seed?.secret ?? await browserSecret();
  const secret = /^[a-f0-9]{64}$/.test(previousSecret) ? previousSecret : randomBytes(32).toString("hex");
  const browserHash = hashToken(secret);
  const id = seed?.id ?? randomBytes(32).toString("hex");
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await env.DB!.prepare("DELETE FROM auth_email_challenges WHERE expires_at <= ?").bind(now).run();
  await env.DB!.prepare("INSERT INTO auth_email_challenges (id, user_id, purpose, browser_hash, code_hash, password_version, session_hash, new_password_hash, redirect_to, attempts, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)")
    .bind(id, account.userId, purpose, browserHash, codeHash(id, secret, code), hashToken(account.passwordHash), sessionHash, newPasswordHash, redirectTo, now + TEN_MINUTES, now).run();
  try { await sendAuthEmail(request, account.email, code, purpose, id); }
  catch (error) { await env.DB!.prepare("DELETE FROM auth_email_challenges WHERE id = ?").bind(id).run(); throw error; }
  await env.DB!.prepare("DELETE FROM auth_email_challenges WHERE user_id = ? AND purpose = ? AND browser_hash = ? AND id != ?")
    .bind(account.userId, purpose, browserHash, id).run();
  const [name, domain] = account.email.split("@");
  return Response.json({ requiresCode: true, challengeId: id, emailMasked: `${name[0]}***@${domain}`, expiresAt: now + TEN_MINUTES, resendAfter: 60 }, {
    headers: { "Cache-Control": "no-store", "Set-Cookie": challengeCookie(secret, request) },
  });
}

export async function readEmailChallenge(request: Request, id: unknown) {
  await limitAuthAttempts(`email-verify-ip:${requestIp(request)}`, 60);
  const secret = await browserSecret();
  if (typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id) || !/^[a-f0-9]{64}$/.test(secret)) throw new AuthFlowError("Yêu cầu xác nhận không hợp lệ. Vui lòng bắt đầu lại.");
  const challenge = await env.DB!.prepare("SELECT * FROM auth_email_challenges WHERE id = ? AND browser_hash = ? AND expires_at > ? AND attempts < 5")
    .bind(id, hashToken(secret), Date.now()).first<EmailChallenge>();
  if (!challenge) throw new AuthFlowError("Mã đã hết hạn, đã dùng hoặc vượt số lần thử. Vui lòng bắt đầu lại.");
  const row = await env.DB!.prepare("SELECT user_id AS userId, email, display_name AS displayName, password_hash AS passwordHash, is_owner AS isOwner FROM website_accounts WHERE user_id = ?")
    .bind(challenge.user_id).first<OwnerAccount & { displayName: string; isOwner: number }>();
  const account = row ? { ...row, isOwner: row.isOwner === 1 } : null;
  if (!account || ((challenge.purpose !== "reset" || account.isOwner) && !isAdminIdentity(account)) || hashToken(account.passwordHash) !== challenge.password_version) throw new AuthFlowError("Tài khoản đã thay đổi. Vui lòng đăng nhập lại.", 401);
  if (challenge.purpose === "password") {
    const token = (await cookies()).get(AUTH_COOKIE)?.value || "";
    const session = await env.DB!.prepare("SELECT token_hash FROM website_sessions WHERE token_hash = ? AND user_id = ? AND expires_at > ? AND owner_verified = 1")
      .bind(hashToken(token), challenge.user_id, Date.now()).first();
    if (!session || hashToken(token) !== challenge.session_hash) throw new AuthFlowError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  }
  return { challenge, account, secret };
}

export async function consumeEmailChallenge(request: Request, id: unknown, code: unknown, purpose?: EmailChallenge["purpose"] | EmailChallenge["purpose"][]) {
  const result = await readEmailChallenge(request, id);
  if (purpose && !(Array.isArray(purpose) ? purpose : [purpose]).includes(result.challenge.purpose)) throw new AuthFlowError("Mã xác nhận không dành cho thao tác này.");
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) throw new AuthFlowError("Vui lòng nhập mã xác nhận gồm 6 chữ số.");
  const { challenge, secret } = result;
  const attempt = await env.DB!.prepare("UPDATE auth_email_challenges SET attempts = attempts + 1 WHERE id = ? AND browser_hash = ? AND expires_at > ? AND attempts < 5 RETURNING attempts")
    .bind(challenge.id, challenge.browser_hash, Date.now()).first<{ attempts: number }>();
  if (!attempt) throw new AuthFlowError("Mã đã hết hạn hoặc vượt số lần thử. Vui lòng bắt đầu lại.");
  // DELETE RETURNING makes consumption atomic: parallel requests cannot reuse a code.
  const consumed = await env.DB!.prepare("DELETE FROM auth_email_challenges WHERE id = ? AND browser_hash = ? AND code_hash = ? AND expires_at > ? AND attempts <= 5 RETURNING id")
    .bind(challenge.id, challenge.browser_hash, codeHash(challenge.id, secret, code), Date.now()).first();
  if (!consumed) throw new AuthFlowError(attempt.attempts >= 5 ? "Đã nhập sai mã 5 lần. Vui lòng bắt đầu lại." : `Mã xác nhận không đúng. Còn ${5 - attempt.attempts} lần thử.`);
  return result;
}

export async function cancelEmailChallenges() {
  const secret = await browserSecret();
  if (/^[a-f0-9]{64}$/.test(secret)) await env.DB!.batch([
    env.DB!.prepare("DELETE FROM auth_email_challenges WHERE browser_hash = ?").bind(hashToken(secret)),
    env.DB!.prepare("DELETE FROM auth_password_reset_requests WHERE browser_hash = ?").bind(hashToken(secret)),
  ]);
}
