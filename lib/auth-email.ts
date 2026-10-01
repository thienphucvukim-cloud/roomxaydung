import { env } from "cloudflare:workers";
import { AuthFlowError } from "@/lib/auth-security";

type EmailBinding = { send: (message: { to: string; from: string; subject: string; text: string }) => Promise<unknown> };
type MailEnv = { AUTH_EMAIL_PROVIDER?: string; AUTH_EMAIL_FROM?: string; RESEND_API_KEY?: string; AUTH_EMAIL?: EmailBinding };
function settings() { return env as unknown as MailEnv; }
function localTest(request: Request) {
  return import.meta.env.DEV && settings().AUTH_EMAIL_PROVIDER === "test" && ["localhost", "127.0.0.1"].includes(new URL(request.url).hostname);
}
export function authEmailReady(request?: Request) {
  const config = settings();
  if (import.meta.env.DEV && request && localTest(request)) return true;
  if (!config.AUTH_EMAIL_FROM || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.AUTH_EMAIL_FROM)) return false;
  return (config.AUTH_EMAIL_PROVIDER === "resend" && Boolean(config.RESEND_API_KEY)) || (config.AUTH_EMAIL_PROVIDER === "cloudflare" && Boolean(config.AUTH_EMAIL));
}
export async function sendAuthEmail(request: Request, email: string, code: string, purpose: "login" | "password" | "reset", challengeId: string) {
  if (!authEmailReady(request)) throw new AuthFlowError("Chưa cấu hình dịch vụ gửi mã xác nhận. Vui lòng liên hệ chủ website.", 503);
  const operation = purpose === "login" ? "đăng nhập quản lý" : purpose === "reset" ? "khôi phục mật khẩu" : "đổi mật khẩu";
  const subject = `Tipook: mã xác nhận ${operation}`;
  const text = `Mã xác nhận ${operation} của bạn: ${code}\n\nMã có hiệu lực 10 phút, chỉ dùng một lần. Không chia sẻ mã này với bất kỳ ai.\nNếu bạn không yêu cầu thao tác này, hãy bỏ qua email và kiểm tra bảo mật tài khoản.`;
  // An explicit developer-only outbox lets integration tests inspect delivery.
  // This branch is removed from production builds and never exposes codes via HTTP.
  if (import.meta.env.DEV && localTest(request)) {
    await env.DB!.prepare("CREATE TABLE IF NOT EXISTS auth_email_test_outbox (id TEXT PRIMARY KEY, recipient TEXT NOT NULL, code TEXT NOT NULL, purpose TEXT NOT NULL)").run();
    await env.DB!.prepare("INSERT INTO auth_email_test_outbox (id, recipient, code, purpose) VALUES (?, ?, ?, ?)").bind(challengeId, email, code, purpose).run();
    return;
  }
  const config = settings();
  try {
    if (config.AUTH_EMAIL_PROVIDER === "cloudflare") {
      await config.AUTH_EMAIL!.send({ from: config.AUTH_EMAIL_FROM!, to: email, subject, text });
    } else {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `tipook-auth-${challengeId}` },
        body: JSON.stringify({ from: config.AUTH_EMAIL_FROM, to: [email], subject, text }), signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error("Email provider rejected delivery");
    }
  } catch {
    // Provider responses can contain addresses and API details; keep them private.
    throw new AuthFlowError("Chưa gửi được mã xác nhận. Vui lòng thử lại sau ít phút.", 503);
  }
}
