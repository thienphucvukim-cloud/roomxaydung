import { randomUUID } from "node:crypto";
import { env } from "cloudflare:workers";
import { requireAdmin } from "@/lib/admin-auth";
import { validOrigin } from "@/lib/website-auth";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;
  if (!validOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 }); }
  if (!body || typeof body.userId !== "string" || !body.userId || body.userId.length > 200 || body.userId.startsWith("guest_")
    || typeof body.action !== "string" || !["disable", "enable", "delete"].includes(body.action) || typeof body.reason !== "string" || body.reason.trim().length < 5 || body.reason.length > 500
    || typeof body.version !== "number" || !Number.isSafeInteger(body.version) || body.version < 0) {
    return Response.json({ error: "Chọn thành viên, thao tác và ghi lý do từ 5 đến 500 ký tự." }, { status: 400 });
  }
  const bindings = env as unknown as Record<string, string | undefined>;
  try {
    const member = await env.DB!.prepare("SELECT p.user_id AS userId, coalesce(a.email, p.email) AS email, a.is_owner AS isOwner, p.account_status AS status, p.moderation_version AS version FROM member_profiles p LEFT JOIN website_accounts a ON a.user_id = p.user_id WHERE p.user_id = ?")
      .bind(body.userId).first<{ userId: string; email: string | null; isOwner: number | null; status: string; version: number }>();
    if (!member) return Response.json({ error: "Không tìm thấy thành viên." }, { status: 404 });
    if (member.isOwner || member.userId === admin.userId || member.userId === bindings.TIPOOK_ADMIN_USER_ID?.trim()
      || (member.email && member.email.toLowerCase() === bindings.TIPOOK_ADMIN_EMAIL?.trim().toLowerCase())) {
      return Response.json({ error: "Không thể vô hiệu hóa hoặc xóa tài khoản quản trị." }, { status: 403 });
    }
    if (member.version !== body.version) return Response.json({ error: "Tài khoản vừa thay đổi. Hãy tải lại danh sách." }, { status: 409 });
    if (member.status === "deleted" || (body.action === "enable" && member.status !== "disabled") || (body.action === "disable" && member.status !== "active")) {
      return Response.json({ error: "Thao tác không phù hợp với trạng thái tài khoản." }, { status: 409 });
    }
    const status = body.action === "enable" ? "active" : body.action === "delete" ? "deleted" : "disabled";
    const auditId = randomUUID(), now = new Date().toISOString();
    const guard = "EXISTS (SELECT 1 FROM admin_member_moderation WHERE id = ?)";
    // Audit is inserted only for the exact version approved in the member form.
    // Every subsequent write is guarded by that audit ID within one transaction.
    const statements = [
      env.DB!.prepare("INSERT INTO admin_member_moderation (id, user_id, performed_by, action, reason, version, created_at) SELECT ?, user_id, ?, ?, ?, moderation_version + 1, ? FROM member_profiles WHERE user_id = ? AND moderation_version = ? AND account_status = ? AND NOT EXISTS (SELECT 1 FROM website_accounts WHERE user_id = member_profiles.user_id AND is_owner = 1) RETURNING id")
        .bind(auditId, admin.userId, body.action, body.reason.trim(), now, member.userId, body.version, member.status),
      env.DB!.prepare(`UPDATE member_profiles SET account_status = ?, moderation_reason = ?, moderation_version = moderation_version + 1, updated_at = ? WHERE user_id = ? AND ${guard}`)
        .bind(status, body.reason.trim(), now, member.userId, auditId),
    ];
    if (status !== "active") {
      statements.push(
        env.DB!.prepare(`DELETE FROM website_sessions WHERE user_id = ? AND ${guard}`).bind(member.userId, auditId),
        env.DB!.prepare(`DELETE FROM auth_email_challenges WHERE user_id = ? AND ${guard}`).bind(member.userId, auditId),
        env.DB!.prepare(`DELETE FROM auth_password_reset_requests WHERE email = ? AND ${guard}`).bind(member.email, auditId),
        env.DB!.prepare(`UPDATE posts SET audience = 'Ẩn bởi quản trị' WHERE user_id = ? AND audience = 'Công khai' AND ${guard}`).bind(member.userId, auditId),
      );
    }
    const results = await env.DB!.batch(statements);
    if (!results[0].results.length) return Response.json({ error: "Tài khoản vừa thay đổi. Hãy tải lại danh sách." }, { status: 409 });
    return Response.json({ ok: true, accountStatus: status }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Chưa thể xử lý tài khoản. Vui lòng tải lại danh sách trước khi thử lại." }, { status: 500 }); }
}
