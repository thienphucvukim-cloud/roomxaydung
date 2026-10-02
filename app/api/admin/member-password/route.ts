import { randomUUID } from "node:crypto";
import { env } from "cloudflare:workers";
import { requireAdmin } from "@/lib/admin-auth";
import { AuthFlowError, limitAuthAttempts } from "@/lib/auth-security";
import { hashPassword, verifyPassword } from "@/lib/password";
import { validOrigin } from "@/lib/website-auth";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId || userId.length > 200) return Response.json({ error: "Mã tài khoản không hợp lệ." }, { status: 400 });
  try {
    const history = await env.DB!.prepare("SELECT id, performed_by AS performedBy, verification_note AS verificationNote, created_at AS createdAt FROM admin_member_password_resets WHERE user_id = ? ORDER BY created_at DESC LIMIT 20").bind(userId).all();
    return Response.json({ history: history.results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "Chưa thể tải lịch sử hỗ trợ." }, { status: 500 }); }
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;
  if (!validOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 }); }
  if (!body || typeof body.userId !== "string" || !body.userId || body.userId.length > 200
    || body.verified !== true || typeof body.verificationNote !== "string" || body.verificationNote.trim().length < 10 || body.verificationNote.length > 500
    || typeof body.newPassword !== "string" || body.newPassword.length < 6 || body.newPassword.length > 128
    || typeof body.adminPassword !== "string" || !body.adminPassword || body.adminPassword.length > 128) {
    return Response.json({ error: "Xác nhận đã xác minh chủ tài khoản, ghi cách xác minh (10–500 ký tự), nhập mật khẩu mới (6–128 ký tự) và mật khẩu quản trị." }, { status: 400 });
  }
  try {
    await limitAuthAttempts(`admin-member-reset:${admin.userId}`, 10);
    const operator = await env.DB!.prepare("SELECT password_hash AS passwordHash FROM website_accounts WHERE user_id = ?").bind(admin.userId).first<{ passwordHash: string }>();
    if (!operator || !await verifyPassword(body.adminPassword, operator.passwordHash)) return Response.json({ error: "Mật khẩu quản trị không đúng." }, { status: 403 });
    const account = await env.DB!.prepare("SELECT user_id AS userId, email, password_hash AS passwordHash, is_owner AS isOwner FROM website_accounts WHERE user_id = ?").bind(body.userId).first<{ userId: string; email: string | null; passwordHash: string; isOwner: number }>();
    if (!account) return Response.json({ error: "Không tìm thấy tài khoản đăng nhập." }, { status: 404 });
    const profile = await env.DB!.prepare("SELECT account_status AS status FROM member_profiles WHERE user_id = ?").bind(account.userId).first<{ status: string }>();
    if (profile && profile.status !== "active") return Response.json({ error: "Tài khoản đã bị vô hiệu hóa hoặc xóa. Không thể đặt lại mật khẩu." }, { status: 403 });
    const bindings = env as unknown as Record<string, string | undefined>;
    if (account.isOwner || account.userId === admin.userId || account.userId === bindings.TIPOOK_ADMIN_USER_ID?.trim()
      || (account.email && account.email.toLowerCase() === bindings.TIPOOK_ADMIN_EMAIL?.trim().toLowerCase())) {
      return Response.json({ error: "Chức năng này chỉ hỗ trợ thành viên. Tài khoản quản trị dùng quy trình khôi phục riêng." }, { status: 403 });
    }
    const passwordHash = await hashPassword(body.newPassword);
    const guard = "EXISTS (SELECT 1 FROM website_accounts WHERE user_id = ? AND password_hash = ?)";
    const results = await env.DB!.batch([
      env.DB!.prepare("UPDATE website_accounts SET password_hash = ? WHERE user_id = ? AND password_hash = ? AND is_owner = 0 AND NOT EXISTS (SELECT 1 FROM member_profiles WHERE user_id = website_accounts.user_id AND account_status != 'active') RETURNING user_id").bind(passwordHash, account.userId, account.passwordHash),
      env.DB!.prepare(`INSERT INTO admin_member_password_resets (id, user_id, performed_by, verification_note, created_at) SELECT ?, ?, ?, ?, ? WHERE ${guard}`).bind(randomUUID(), account.userId, admin.userId, body.verificationNote.trim(), new Date().toISOString(), account.userId, passwordHash),
      env.DB!.prepare(`DELETE FROM website_sessions WHERE user_id = ? AND ${guard}`).bind(account.userId, account.userId, passwordHash),
      env.DB!.prepare(`DELETE FROM auth_email_challenges WHERE user_id = ? AND ${guard}`).bind(account.userId, account.userId, passwordHash),
      env.DB!.prepare(`DELETE FROM auth_password_reset_requests WHERE email = ? AND ${guard}`).bind(account.email, account.userId, passwordHash),
    ]);
    if (!results[0].results.length) return Response.json({ error: "Tài khoản vừa thay đổi. Vui lòng kiểm tra lại trước khi đặt mật khẩu." }, { status: 409 });
    return Response.json({ passwordReset: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthFlowError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Chưa thể đặt lại mật khẩu. Vui lòng kiểm tra lịch sử hỗ trợ trước khi thử lại." }, { status: 500 });
  }
}
