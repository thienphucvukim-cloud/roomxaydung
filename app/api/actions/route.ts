import { memberAccessResponse } from "@/lib/member-access";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { currentUserId } from "../../../lib/member-identity";
import { getDb } from "../../../db";
import { memberProfiles, userActions, virtualProfiles } from "../../../db/schema";
import { getPaymentBuyerId } from "@/lib/payment-identity";
import { memberAvatarUrl } from "@/lib/member-avatar";

function valid(value: unknown, max = 120): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

export async function GET(request: Request) {
  try {
    const userId = await getPaymentBuyerId();
    const url = new URL(request.url);
    const actionType = url.searchParams.get("actionType");
    const targetType = url.searchParams.get("targetType");
    const targetId = url.searchParams.get("targetId");
    const conditions = [eq(userActions.userId, userId ?? "")];
    if (actionType) conditions.push(eq(userActions.actionType, actionType));
    if (targetType) conditions.push(eq(userActions.targetType, targetType));
    if (targetId) conditions.push(eq(userActions.targetId, targetId));
    const actions = userId ? await getDb().select().from(userActions).where(and(...conditions)).orderBy(desc(userActions.createdAt)).limit(100) : [];
    if (url.searchParams.get("withCount") === "true" && valid(actionType, 50) && valid(targetType, 50) && valid(targetId, 180)) {
      const [total] = await getDb().select({ value: count() }).from(userActions).where(and(
        eq(userActions.actionType, actionType),
        eq(userActions.targetType, targetType),
        eq(userActions.targetId, targetId),
      ));
      return Response.json({ actions, count: total.value });
    }
    if (url.searchParams.get("withProfiles") === "true") {
      const ids = [...new Set(actions.filter(action => action.targetType === "profile").map(action => action.targetId))];
      const db = getDb();
      const profiles = ids.length ? await db.select({ id: memberProfiles.userId, name: memberProfiles.displayName, avatarKey: memberProfiles.avatarKey, googleAvatarUrl: memberProfiles.googleAvatarUrl }).from(memberProfiles).where(inArray(memberProfiles.userId, ids)) : [];
      const members = profiles.map(profile => ({ id: profile.id, name: profile.name, avatarUrl: memberAvatarUrl(profile) }));
      const missing = ids.filter(id => !members.some(member => member.id === id));
      if (missing.length) {
        try {
          const virtual = await db.select({ id: virtualProfiles.id, name: virtualProfiles.displayName, avatarUrl: virtualProfiles.avatar }).from(virtualProfiles).where(inArray(virtualProfiles.id, missing));
          members.push(...virtual);
        } catch { /* Virtual profiles may not be available on older databases. */ }
      }
      return Response.json({ actions, members }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return Response.json({ actions });
  } catch {
    return Response.json({ error: "Chưa thể tải hoạt động." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await memberAccessResponse();
  if (denied) return denied;
  try {
    const body = await request.json() as { actionType?: string; targetType?: string; targetId?: string; payload?: unknown };
    if (!valid(body.actionType, 50) || !valid(body.targetType, 50) || !valid(body.targetId, 180)) {
      return Response.json({ error: "Hành động không hợp lệ." }, { status: 400 });
    }
    const userId = await currentUserId();
    const [existing] = await getDb().select({ id: userActions.id }).from(userActions).where(and(
      eq(userActions.userId, userId),
      eq(userActions.actionType, body.actionType),
      eq(userActions.targetType, body.targetType),
      eq(userActions.targetId, body.targetId),
    )).limit(1);
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
    return Response.json({ action, active: true, created: !existing });
  } catch {
    return Response.json({ error: "Chưa thể lưu hành động." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await memberAccessResponse();
  if (denied) return denied;
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
