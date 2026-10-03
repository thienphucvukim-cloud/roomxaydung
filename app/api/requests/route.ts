import { memberAccessResponse } from "@/lib/member-access";
import { desc, eq } from "drizzle-orm";
import { currentMember } from "../../../lib/member-identity";
import { getDb } from "../../../db";
import { deliveryProfiles, directMessages, memberProfiles, posts, userRequests, virtualProfiles } from "../../../db/schema";
import { env } from "cloudflare:workers";
import { deliverExternalMessages } from "../../../lib/request-delivery";
import { resolveMessageRecipient } from "../../../lib/message-recipient";
import { requestTargetLink } from "../../../lib/request-target-link";

const supportedChannels = ["internal", "zalo", "messenger", "telegram"] as const;
type Channel = typeof supportedChannels[number];

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET() {
  const denied = await memberAccessResponse();
  if (denied) return denied;
  try {
    const member = await currentMember();
    const requests = await getDb().select().from(userRequests).where(eq(userRequests.userId, member.userId)).orderBy(desc(userRequests.createdAt)).limit(50);
    return Response.json({ requests });
  } catch {
    return Response.json({ error: "Chưa thể tải yêu cầu." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await memberAccessResponse();
  if (denied) return denied;
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
    const internalOnly = requestType === "expert-question";
    const fileRequest = requestType === "drawing-file-request";
    const adminHelp = requestType === "admin-help";
    const adminRequest = fileRequest || adminHelp;
    const channels: Channel[] = adminRequest ? ["internal", "telegram"] : internalOnly ? ["internal"] : Array.from(new Set(requestedChannels));
    if (attachmentKey && !/^[0-9a-f-]{36}$/i.test(attachmentKey)) return Response.json({ error: "Tệp đính kèm không hợp lệ." }, { status: 400 });
    if (!requestType || !targetType || !targetId || !subject || (!content && !(adminHelp && attachmentKey)) || !channels.length) return Response.json({ error: "Vui lòng nhập đầy đủ nội dung và chọn ít nhất một kênh." }, { status: 400 });

    let recipientUserId = adminRequest ? "" : await resolveMessageRecipient(targetType, targetId, requestedRecipient);
    const routedRequest = requestType === "expert-question" || requestType === "drawing-purchase";
    if (routedRequest && !recipientUserId) return Response.json({ error: "Chưa xác định được người đăng để nhận tin nhắn." }, { status: 400 });

    const member = await currentMember();
    let telegramFile: File | undefined;
    let attachmentName = "";
    if (attachmentKey) {
      const object = await env.BUCKET?.head(attachmentKey);
      if (!object) return Response.json({ error: "Không tìm thấy tệp đính kèm. Vui lòng tải lại tệp." }, { status: 400 });
      if (object.customMetadata?.ownerUserId !== member.userId || object.customMetadata?.accessType !== "public") return Response.json({ error: "Bạn không có quyền gửi tệp đính kèm này." }, { status: 403 });
      if (adminHelp) {
        if (object.size > 25 * 1024 * 1024) return Response.json({ error: "Tệp đính kèm không được vượt quá 25 MB." }, { status: 413 });
        attachmentName = decodeURIComponent(object.customMetadata?.fileName || "tep-dinh-kem");
        const file = await env.BUCKET?.get(attachmentKey);
        if (!file) return Response.json({ error: "Không tìm thấy tệp đính kèm. Vui lòng tải lại tệp." }, { status: 400 });
        telegramFile = new File([await file.arrayBuffer()], attachmentName, { type: object.httpMetadata?.contentType || "application/octet-stream" });
      }
    }
    const db = getDb();
    const [sampleProfile] = recipientUserId ? await db.select({ id: virtualProfiles.id }).from(virtualProfiles).where(eq(virtualProfiles.id, recipientUserId)).limit(1) : [];
    if (!recipientUserId || (sampleProfile && !internalOnly)) {
      const bindings = env as unknown as Record<string, string | undefined>;
      const [adminProfile] = bindings.TIPOOK_ADMIN_EMAIL
        ? await db.select({ userId: memberProfiles.userId }).from(memberProfiles).where(eq(memberProfiles.email, bindings.TIPOOK_ADMIN_EMAIL.trim().toLowerCase())).limit(1)
        : [];
      recipientUserId = bindings.TIPOOK_ADMIN_USER_ID?.trim() || adminProfile?.userId || "";
      if (!recipientUserId) return Response.json({ error: "Quản trị viên cần đăng nhập lần đầu để kích hoạt hộp thư tiếp nhận tư vấn." }, { status: 503 });
    }
    const effectiveRecipient = recipientUserId;
    const [saved] = await db.insert(userRequests).values({
      userId: member.userId, authorName: member.authorName, requestType, targetType, targetId, subject, content, contact: contact || null, attachmentKey: attachmentKey || null,
      recipientUserId: effectiveRecipient, channels: JSON.stringify(channels), deliveryStatus: JSON.stringify({ pending: channels }),
    }).returning();

    const delivery: Record<string, { status: string; detail?: string }> = {};
    if (channels.includes("internal")) {
      await db.insert(directMessages).values({ senderUserId: member.userId, senderName: member.authorName, recipientUserId: effectiveRecipient, requestId: saved.id, subject, content, attachmentKey: attachmentKey || null });
      delivery.internal = { status: "sent" };
    }

    const external = channels.filter((channel): channel is "zalo" | "messenger" | "telegram" => channel !== "internal");
    if (external.length) {
      const [realProfile] = await db.select({ zaloUserId: deliveryProfiles.zaloUserId, messengerPsid: deliveryProfiles.messengerPsid, telegramChatId: deliveryProfiles.telegramChatId }).from(deliveryProfiles).where(eq(deliveryProfiles.userId, effectiveRecipient)).limit(1);
      const [virtualProfile] = realProfile ? [] : await db.select({ zaloUserId: virtualProfiles.zaloUserId, messengerPsid: virtualProfiles.messengerPsid, telegramChatId: virtualProfiles.telegramChatId }).from(virtualProfiles).where(eq(virtualProfiles.id, effectiveRecipient)).limit(1);
      const profile = realProfile ?? virtualProfile ?? {};
      const bindings = env as unknown as Record<string, string | undefined>;
      const deliveryProfile = adminRequest
        ? { telegramChatId: bindings.TELEGRAM_ADMIN_CHAT_ID?.trim() || profile.telegramChatId }
        : profile;
      const [targetPost] = fileRequest && targetType === "post"
        ? await db.select({ category: posts.category }).from(posts).where(eq(posts.id, Number(targetId))).limit(1)
        : [];
      const postLink = fileRequest ? requestTargetLink(new URL(request.url).origin, targetType, targetId, targetPost?.category) : "";
      const context = fileRequest ? `\nMã yêu cầu: #${saved.id}\nFile: ${targetId}\nLink bài viết: ${postLink}${member.email ? `\nEmail: ${member.email}` : ""}` : adminHelp ? `\nMã yêu cầu: #${saved.id}\nTrang: ${targetId}\nID: ${member.userId}${member.email ? `\nEmail: ${member.email}` : ""}` : "";
      const attachmentLink = adminHelp && attachmentKey ? `\nTệp: ${attachmentName}\n${new URL("/api/files?key=" + encodeURIComponent(attachmentKey) + "&download=1", request.url).href}` : "";
      Object.assign(delivery, await deliverExternalMessages(external, deliveryProfile, `[NhàĐẹpChất] ${member.authorName}: ${subject}${context}\n${content}${contact ? `\nLiên hệ: ${contact}` : ""}${attachmentLink}`, telegramFile ? { file: telegramFile, caption: `Yêu cầu #${saved.id} · ${member.authorName}: ${subject}` } : undefined));
    }
    await db.update(userRequests).set({ deliveryStatus: JSON.stringify(delivery) }).where(eq(userRequests.id, saved.id));
    return Response.json({ request: { ...saved, deliveryStatus: JSON.stringify(delivery) }, delivery }, { status: 201 });
  } catch {
    return Response.json({ error: "Chưa thể gửi yêu cầu lúc này." }, { status: 500 });
  }
}
