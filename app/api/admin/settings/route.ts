import { env } from "cloudflare:workers";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;
  const bindings = env as unknown as Record<string, string | undefined>;
  return Response.json({
    adminEmail: bindings.TIPOOK_ADMIN_EMAIL || null,
    adminUserId: bindings.TIPOOK_ADMIN_USER_ID || null,
    bankCode: bindings.ADMIN_BANK_CODE || null,
    bankAccount: bindings.ADMIN_BANK_ACCOUNT ? "•••• " + bindings.ADMIN_BANK_ACCOUNT.slice(-4) : null,
    bankName: bindings.ADMIN_BANK_NAME || null,
    database: Boolean(env.DB), storage: Boolean(env.BUCKET),
    downloads: Boolean(bindings.DOWNLOAD_LINK_SECRET && bindings.DOWNLOAD_LINK_SECRET.length >= 32),
    passwordAccount: admin.identity?.source === "website",
  }, { headers: { "Cache-Control": "private, no-store" } });
}
