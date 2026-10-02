import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { deliveryProfiles, memberProfiles } from "../db/schema";
import { deliverExternalMessages } from "./request-delivery";

// Notifications must never undo a completed wallet operation.
export async function notifyAdminTelegram(message: string, buyerId: string) {
  try {
    const bindings = env as unknown as Record<string, string | undefined>;
    const db = getDb();
    let chatId = bindings.TELEGRAM_ADMIN_CHAT_ID?.trim();
    if (!chatId) {
      const [admin] = bindings.TIPOOK_ADMIN_EMAIL
        ? await db.select({ userId: memberProfiles.userId }).from(memberProfiles).where(eq(memberProfiles.email, bindings.TIPOOK_ADMIN_EMAIL.trim().toLowerCase())).limit(1)
        : [];
      const adminId = bindings.TIPOOK_ADMIN_USER_ID?.trim() || admin?.userId;
      const [profile] = adminId ? await db.select({ chatId: deliveryProfiles.telegramChatId }).from(deliveryProfiles).where(eq(deliveryProfiles.userId, adminId)).limit(1) : [];
      chatId = profile?.chatId || undefined;
    }
    const [buyer] = await db.select({ name: memberProfiles.displayName, email: memberProfiles.email }).from(memberProfiles).where(eq(memberProfiles.userId, buyerId)).limit(1);
    const identity = `\nNgười dùng: ${buyer?.name || buyerId}${buyer?.email ? `\nEmail: ${buyer.email}` : ""}\nID: ${buyerId}`;
    const result = await deliverExternalMessages(["telegram"], { telegramChatId: chatId }, message + identity);
    return result.telegram;
  } catch {
    return { status: "failed" as const, detail: "notification-error" };
  }
}
