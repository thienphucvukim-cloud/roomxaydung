import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../db";
import { directMessages } from "../../../db/schema";

async function currentUserId() {
  return (await headers()).get("oai-authenticated-user-id") ?? "private-member";
}

export async function GET() {
  try {
    const messages = await getDb().select().from(directMessages).where(eq(directMessages.recipientUserId, await currentUserId())).orderBy(desc(directMessages.createdAt)).limit(100);
    return Response.json({ messages });
  } catch {
    return Response.json({ error: "Chưa thể tải tin nhắn nội bộ." }, { status: 500 });
  }
}