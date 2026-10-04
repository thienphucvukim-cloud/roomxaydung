import { isSystemMessageSender } from "@/lib/legacy-contracts";
import { memberAccessResponse } from "@/lib/member-access";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { directMessages, memberProfiles, virtualProfiles } from "../../../db/schema";
import { getPaymentBuyerId } from "../../../lib/payment-identity";
import { currentMember } from "../../../lib/member-identity";
import { messageRecipientName, resolveMessageRecipient } from "../../../lib/message-recipient";
import { env } from "cloudflare:workers";

async function currentUserIds() {
  const paymentBuyerId = await getPaymentBuyerId();
  return paymentBuyerId ? [paymentBuyerId] : [];
}

function conversationCondition(userId: string, peerId: string) {
  return or(and(eq(directMessages.senderUserId, userId), eq(directMessages.recipientUserId, peerId)), and(eq(directMessages.senderUserId, peerId), eq(directMessages.recipientUserId, userId)));
}

export async function POST(request: Request) {
  const denied = await memberAccessResponse();
  if (denied) return denied;
  try {
    const userId = await getPaymentBuyerId();
    if (!userId) return Response.json({ error: "Vui lòng đăng nhập để nhắn tin." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const peerId = typeof body.peerId === "string" ? body.peerId.trim().slice(0, 180) : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const attachmentKey = typeof body.attachmentKey === "string" ? body.attachmentKey.trim() : "";
    if (!peerId || !content || content.length > 2000 || peerId === userId || isSystemMessageSender(peerId)) return Response.json({ error: "Tin nhắn hoặc người nhận không hợp lệ." }, { status: 400 });
    const db = getDb();
    const [previous] = await db.select({ id: directMessages.id }).from(directMessages).where(conversationCondition(userId, peerId)).limit(1);
    const [profile] = await db.select({ id: memberProfiles.userId }).from(memberProfiles).where(eq(memberProfiles.userId, peerId)).limit(1);
    const [virtual] = await db.select({ id: virtualProfiles.id }).from(virtualProfiles).where(eq(virtualProfiles.id, peerId)).limit(1);
    if (!previous && !profile && !virtual) return Response.json({ error: "Không tìm thấy người nhận." }, { status: 404 });
    if (attachmentKey) {
      if (!/^[0-9a-f-]{36}$/i.test(attachmentKey)) return Response.json({ error: "Tệp không hợp lệ." }, { status: 400 });
      const file = await env.BUCKET?.head(attachmentKey);
      if (!file || file.customMetadata?.ownerUserId !== userId || file.customMetadata?.accessType === "private") return Response.json({ error: "Không thể gửi tệp này." }, { status: 403 });
    }
    const member = await currentMember();
    const [message] = await db.insert(directMessages).values({ senderUserId: userId, senderName: member.authorName, recipientUserId: peerId, subject: "Tin nhắn", content, attachmentKey: attachmentKey || null }).returning();
    return Response.json({ message }, { status: 201 });
  } catch { return Response.json({ error: "Không thể gửi tin nhắn." }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  const denied = await memberAccessResponse();
  if (denied) return denied;
  try {
    const userIds = await currentUserIds();
    if (!userIds.length) return Response.json({ error: "Phiên tài khoản không hợp lệ." }, { status: 401 });
    const body = await request.json() as { id?: unknown; ids?: unknown[] };
    const ids = (Array.isArray(body.ids) ? body.ids : [body.id]).map(Number);
    if (!ids.length || ids.length > 100 || ids.some(id => !Number.isSafeInteger(id) || id < 1)) return Response.json({ error: "Tin nhắn không hợp lệ." }, { status: 400 });
    const [message] = await getDb().update(directMessages).set({ readAt: new Date().toISOString() }).where(and(inArray(directMessages.id, ids), inArray(directMessages.recipientUserId, userIds))).returning({ id: directMessages.id });
    if (!message) return Response.json({ error: "Không tìm thấy tin nhắn." }, { status: 404 });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Không thể đánh dấu tin nhắn đã đọc." }, { status: 500 }); }
}

export async function GET(request: Request) {
  try {
    const userIds = await currentUserIds();
    if (!userIds.length) return Response.json({ messages: [] });
    const url = new URL(request.url);
    const db = getDb();
    const userId = userIds[0];
    if (url.searchParams.get("mode") === "conversations") {
      const peer = sql<string>`case when ${directMessages.senderUserId} = ${userId} then ${directMessages.recipientUserId} else ${directMessages.senderUserId} end`;
      const groups = await db.select({ peerId: peer, lastId: sql<number>`max(${directMessages.id})`, unread: sql<number>`sum(case when ${directMessages.recipientUserId} = ${userId} and ${directMessages.readAt} is null then 1 else 0 end)` }).from(directMessages).where(or(eq(directMessages.senderUserId, userId), eq(directMessages.recipientUserId, userId))).groupBy(peer).orderBy(desc(sql`max(${directMessages.id})`)).limit(100);
      const ids = groups.map(group => group.lastId);
      const lastMessages = ids.length ? await db.select().from(directMessages).where(inArray(directMessages.id, ids)) : [];
      const peerIds = groups.map(group => group.peerId);
      const members = peerIds.length ? await db.select({ id: memberProfiles.userId, name: memberProfiles.displayName }).from(memberProfiles).where(inArray(memberProfiles.userId, peerIds)) : [];
      const virtuals = peerIds.length ? await db.select({ id: virtualProfiles.id, name: virtualProfiles.displayName }).from(virtualProfiles).where(inArray(virtualProfiles.id, peerIds)) : [];
      const names = new Map([...virtuals, ...members].map(profile => [profile.id, profile.name]));
      const conversations = groups.map(group => ({ ...group, name: names.get(group.peerId) || lastMessages.find(message => message.senderUserId === group.peerId)?.senderName || "Thành viên", lastMessage: lastMessages.find(message => message.id === group.lastId) }));
      return Response.json({ conversations, currentUserId: userId });
    }
    if (url.searchParams.has("peerId") || url.searchParams.has("targetType")) {
      const targetType = url.searchParams.get("targetType") || "profile";
      const targetId = (url.searchParams.get("targetId") || "").slice(0, 180);
      const peerId = await resolveMessageRecipient(targetType, targetId, (url.searchParams.get("peerId") || "").slice(0, 180));
      if (!peerId) return Response.json({ error: "Không tìm thấy tác giả." }, { status: 404 });
      const before = Number(url.searchParams.get("before"));
      const messages = await db.select().from(directMessages).where(and(conversationCondition(userId, peerId), Number.isSafeInteger(before) && before > 0 ? lt(directMessages.id, before) : undefined)).orderBy(desc(directMessages.id)).limit(51);
      return Response.json({ messages: messages.slice(0, 50).reverse(), hasMore: messages.length > 50, currentUserId: userId, peerId, peerName: await messageRecipientName(peerId) });
    }
    const messages = await db.select().from(directMessages).where(inArray(directMessages.recipientUserId, userIds)).orderBy(desc(directMessages.createdAt)).limit(100);
    return Response.json({ messages });
  } catch {
    return Response.json({ error: "Chưa thể tải tin nhắn nội bộ." }, { status: 500 });
  }
}
