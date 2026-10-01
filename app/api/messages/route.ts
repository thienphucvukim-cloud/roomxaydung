import { and, desc, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../db";
import { directMessages } from "../../../db/schema";
import { getPaymentBuyerId } from "../../../lib/payment-identity";

async function currentUserIds() {
  const authenticatedUserId = (await headers()).get("oai-authenticated-user-id");
  const paymentBuyerId = await getPaymentBuyerId();
  return Array.from(new Set([authenticatedUserId, paymentBuyerId].filter((value): value is string => Boolean(value))));
}

export async function PATCH(request: Request) {
  try {
    const userIds = await currentUserIds();
    if (!userIds.length) return Response.json({ error: "Phiên tài khoản không hợp lệ." }, { status: 401 });
    const body = await request.json() as { id?: unknown };
    const id = Number(body.id);
    if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Tin nhắn không hợp lệ." }, { status: 400 });
    const [message] = await getDb().update(directMessages).set({ readAt: new Date().toISOString() }).where(and(eq(directMessages.id, id), inArray(directMessages.recipientUserId, userIds))).returning({ id: directMessages.id });
    if (!message) return Response.json({ error: "Không tìm thấy tin nhắn." }, { status: 404 });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Không thể đánh dấu tin nhắn đã đọc." }, { status: 500 }); }
}

export async function GET() {
  try {
    const userIds = await currentUserIds();
    if (!userIds.length) return Response.json({ messages: [] });
    const messages = await getDb().select().from(directMessages).where(inArray(directMessages.recipientUserId, userIds)).orderBy(desc(directMessages.createdAt)).limit(100);
    return Response.json({ messages });
  } catch {
    return Response.json({ error: "Chưa thể tải tin nhắn nội bộ." }, { status: 500 });
  }
}
