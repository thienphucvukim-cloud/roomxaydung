import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../db";
import { deliveryProfiles } from "../../../db/schema";

async function currentUserId() {
  return (await headers()).get("oai-authenticated-user-id") ?? "private-member";
}
function value(input: unknown) { return typeof input === "string" ? input.trim().slice(0, 180) : ""; }

export async function GET() {
  try {
    const [profile] = await getDb().select().from(deliveryProfiles).where(eq(deliveryProfiles.userId, await currentUserId())).limit(1);
    return Response.json({ profile: profile ?? null });
  } catch { return Response.json({ error: "Chưa thể tải cấu hình nhận tin." }, { status: 500 }); }
}

export async function PUT(request: Request) {
  try {
    const userId = await currentUserId();
    const body = await request.json() as Record<string, unknown>;
    const data = { userId, zaloUserId: value(body.zaloUserId) || null, messengerPsid: value(body.messengerPsid) || null, telegramChatId: value(body.telegramChatId) || null, internalChatId: value(body.internalChatId) || null, updatedAt: new Date().toISOString() };
    await getDb().insert(deliveryProfiles).values(data).onConflictDoUpdate({ target: deliveryProfiles.userId, set: data });
    return Response.json({ profile: data });
  } catch { return Response.json({ error: "Chưa thể lưu cấu hình nhận tin." }, { status: 500 }); }
}