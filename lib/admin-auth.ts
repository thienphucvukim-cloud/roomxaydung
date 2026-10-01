import { env } from "cloudflare:workers";
import { getAuthenticatedIdentity, isAdminIdentity } from "@/lib/website-auth";

export async function requireAdmin() {
  const bindings = env as unknown as Record<string, string | undefined>;
  const identity = await getAuthenticatedIdentity();
  if (!identity) return { error: Response.json({ error: "Vui lòng đăng nhập tài khoản quản trị." }, { status: 401 }) };
  if (!bindings.TIPOOK_ADMIN_EMAIL?.trim() && !bindings.TIPOOK_ADMIN_USER_ID?.trim()) return { error: Response.json({ error: "Chưa cấu hình tài khoản quản trị." }, { status: 503 }) };
  if (!isAdminIdentity(identity)) return { error: Response.json({ error: "Bạn không có quyền quản trị." }, { status: 403 }) };
  return { userId: identity.userId, identity };
}
