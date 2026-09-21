import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../db";
import { userRequests } from "../../../db/schema";

async function currentMember() {
  const h = await headers();
  const encodedName = h.get("oai-authenticated-user-full-name");
  const email = h.get("oai-authenticated-user-email");
  return {
    userId: h.get("oai-authenticated-user-id") ?? "private-member",
    authorName: encodedName && h.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8"
      ? decodeURIComponent(encodedName)
      : email?.split("@")[0] ?? "Thành viên ROOM",
  };
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
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
    if (attachmentKey && !/^[0-9a-f-]{36}$/i.test(attachmentKey)) return Response.json({ error: "Tệp đính kèm không hợp lệ." }, { status: 400 });
    if (!requestType || !targetType || !targetId || !subject || !content) {
      return Response.json({ error: "Vui lòng nhập đầy đủ nội dung yêu cầu." }, { status: 400 });
    }
    const member = await currentMember();
    const [saved] = await getDb().insert(userRequests).values({
      ...member, requestType, targetType, targetId, subject, content, contact: contact || null, attachmentKey: attachmentKey || null,
    }).returning();
    return Response.json({ request: saved }, { status: 201 });
  } catch {
    return Response.json({ error: "Chưa thể gửi yêu cầu lúc này." }, { status: 500 });
  }
}
