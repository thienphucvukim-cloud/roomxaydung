import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../db";
import { deliveryProfiles, directMessages, posts, userRequests, virtualProfiles } from "../../../db/schema";
import { deliverExternalMessages } from "../../../lib/request-delivery";

const supportedChannels = ["internal", "zalo", "messenger", "telegram"] as const;
type Channel = typeof supportedChannels[number];

async function currentMember() {
  const h = await headers();
  const encodedName = h.get("oai-authenticated-user-full-name");
  const email = h.get("oai-authenticated-user-email");
  return {
    userId: h.get("oai-authenticated-user-id") ?? "private-member",
    authorName: encodedName && h.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8"
      ? decodeURIComponent(encodedName)
      : email?.split("@")[0] ?? "Thành viên Tipook",
  };
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function resolveRecipient(targetType: string, targetId: string, requestedId: string) {
  if (requestedId) return requestedId;
  const db = getDb();
  if (targetType === "post" && /^\d+$/.test(targetId)) {
    const [post] = await db.select({ userId: posts.userId }).from(posts).where(eq(posts.id, Number(targetId))).limit(1);
    return post?.userId ?? "";
  }
  if (targetType === "expert") {
    const [profile] = await db.select({ id: virtualProfiles.id }).from(virtualProfiles).where(eq(virtualProfiles.displayName, targetId)).limit(1);
    return profile?.id ?? "";
  }
  return "";
}

export async function GET() {
  try {
    const member = await currentMember();
    const requests = await getDb().select().from(userRequests).where(eq(userRequests.userId, member.userId)).orderBy(desc(userRequests.createdAt)).limit(50);
    return Response.json({ requests });
  } catch {
    return Response.json({ error: "Chưa thể tải yêu cầu." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const requestType = text(body.requestType, 50);
    const targetType = text(body.targetType, 50);
    const targetId = text(body.targetId, 180);
    const subject = text(body.subject, 180);
    const content = text(body.content, 2000);
    const contact = text(body.contact, 180);
    const attachmentKey = text(body.attachmentKey, 36);
    const requestedRecipient = text(body.recipientUserId, 180);
    const requestedChannels = Array.isArray(body.channels) ? body.channels.filter((value): value is Channel => typeof value === "string" && supportedChannels.includes(value as Channel)) : [...supportedChannels];
    const channels = Array.from(new Set(requestedChannels));
    if (attachmentKey && !/^[0-9a-f-]{36}$/i.test(attachmentKey)) return Response.json({ error: "Tệp đính kèm không hợp lệ." }, { status: 400 });
    if (!requestType || !targetType || !targetId || !subject || !content || !channels.length) return Response.json({ error: "Vui lòng nhập đầy đủ nội dung và chọn ít nhất một kênh." }, { status: 400 });

    const recipientUserId = await resolveRecipient(targetType, targetId, requestedRecipient);
    const routedRequest = requestType === "expert-question" || requestType === "drawing-purchase" || requestType === "drawing-file-request";
    if (routedRequest && !recipientUserId) return Response.json({ error: "Chưa xác định được người đăng để nhận tin nhắn." }, { status: 400 });

    const member = await currentMember();
    const db = getDb();
    const effectiveRecipient = recipientUserId || "tipook-support";
    const [saved] = await db.insert(userRequests).values({
      ...member, requestType, targetType, targetId, subject, content, contact: contact || null, attachmentKey: attachmentKey || null,
      recipientUserId: effectiveRecipient, channels: JSON.stringify(channels), deliveryStatus: JSON.stringify({ pending: channels }),
    }).returning();

    const delivery: Record<string, { status: string; detail?: string }> = {};
    if (channels.includes("internal")) {
      await db.insert(directMessages).values({ senderUserId: member.userId, senderName: member.authorName, recipientUserId: effectiveRecipient, requestId: saved.id, subject, content, attachmentKey: attachmentKey || null });
      delivery.internal = { status: "sent" };
    }

    const [realProfile] = await db.select({ zaloUserId: deliveryProfiles.zaloUserId, messengerPsid: deliveryProfiles.messengerPsid, telegramChatId: deliveryProfiles.telegramChatId }).from(deliveryProfiles).where(eq(deliveryProfiles.userId, effectiveRecipient)).limit(1);
    const [virtualProfile] = realProfile ? [] : await db.select({ zaloUserId: virtualProfiles.zaloUserId, messengerPsid: virtualProfiles.messengerPsid, telegramChatId: virtualProfiles.telegramChatId }).from(virtualProfiles).where(eq(virtualProfiles.id, effectiveRecipient)).limit(1);
    const profile = realProfile ?? virtualProfile ?? {};
    const external = channels.filter((channel): channel is "zalo" | "messenger" | "telegram" => channel !== "internal");
    Object.assign(delivery, await deliverExternalMessages(external, profile ?? {}, `[Tipook] ${member.authorName}: ${subject}\n${content}${contact ? `\nLiên hệ: ${contact}` : ""}`));
    await db.update(userRequests).set({ deliveryStatus: JSON.stringify(delivery) }).where(eq(userRequests.id, saved.id));
    return Response.json({ request: { ...saved, deliveryStatus: JSON.stringify(delivery) }, delivery }, { status: 201 });
  } catch {
    return Response.json({ error: "Chưa thể gửi yêu cầu lúc này." }, { status: 500 });
  }
}