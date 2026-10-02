import { env } from "cloudflare:workers";
import { AuthFlowError } from "@/lib/auth-security";

export async function memberAccountStatus(userId: string) {
  const row = await env.DB!.prepare("SELECT account_status AS status FROM member_profiles WHERE user_id = ?").bind(userId).first<{ status: string }>();
  return row?.status || "active";
}

export async function assertActiveMember(userId: string) {
  const status = await memberAccountStatus(userId);
  if (status !== "active") throw new AuthFlowError(status === "deleted" ? "Tài khoản đã bị xóa. Vui lòng liên hệ quản trị nếu cần hỗ trợ." : "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị nếu cần hỗ trợ.", 403);
}
