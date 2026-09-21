import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../db";
import { userActions } from "../../../db/schema";

async function currentUserId() {
  return (await headers()).get("oai-authenticated-user-id") ?? "private-member";
}

function valid(value: unknown, max = 120): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

export async function GET(request: Request) {
  try {
    const userId = await currentUserId();
    const url = new URL(request.url);
    const actionType = url.searchParams.get("actionType");
    const targetType = url.searchParams.get("targetType");
    const targetId = url.searchParams.get("targetId");
    const conditions = [eq(userActions.userId, userId)];
    if (actionType) conditions.push(eq(userActions.actionType, actionType));
    if (targetType) conditions.push(eq(userActions.targetType, targetType));
    if (targetId) conditions.push(eq(userActions.targetId, targetId));
    const actions = await getDb().select().from(userActions).where(and(...conditions)).orderBy(desc(userActions.createdAt)).limit(100);
    return Response.json({ actions });
  } catch {
    return Response.json({ error: "Chưa thể tải hoạt động." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { actionType?: string; targetType?: string; targetId?: string; payload?: unknown };
    if (!valid(body.actionType, 50) || !valid(body.targetType, 50) || !valid(body.targetId, 180)) {
      return Response.json({ error: "Hành động không hợp lệ." }, { status: 400 });
    }
    const userId = await currentUserId();
    const [action] = await getDb().insert(userActions).values({
      userId,
      actionType: body.actionType,
      targetType: body.targetType,
      targetId: body.targetId,
      payload: body.payload === undefined ? null : JSON.stringify(body.payload).slice(0, 4000),
    }).onConflictDoUpdate({
      target: [userActions.userId, userActions.actionType, userActions.targetType, userActions.targetId],
      set: { payload: body.payload === undefined ? null : JSON.stringify(body.payload).slice(0, 4000), createdAt: new Date().toISOString() },
    }).returning();
    return Response.json({ action, active: true });
  } catch {
    return Response.json({ error: "Chưa thể lưu hành động." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json() as { actionType?: string; targetType?: string; targetId?: string };
    if (!valid(body.actionType, 50) || !valid(body.targetType, 50) || !valid(body.targetId, 180)) {
      return Response.json({ error: "Hành động không hợp lệ." }, { status: 400 });
    }
    const userId = await currentUserId();
    await getDb().delete(userActions).where(and(
      eq(userActions.userId, userId),
      eq(userActions.actionType, body.actionType),
      eq(userActions.targetType, body.targetType),
      eq(userActions.targetId, body.targetId),
    ));
    return Response.json({ active: false });
  } catch {
    return Response.json({ error: "Chưa thể bỏ lưu hành động." }, { status: 500 });
  }
}
