import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { memberProfiles, posts, virtualProfiles } from "../db/schema";
import { houseModels } from "./house-models";

export async function resolveMessageRecipient(targetType: string, targetId: string, requestedId = "") {
  const db = getDb();
  if (targetType === "post") {
    if (!/^\d+$/.test(targetId)) return "";
    const [post] = await db.select({ userId: posts.userId }).from(posts).where(eq(posts.id, Number(targetId))).limit(1);
    return post?.userId ?? "";
  }
  if (targetType === "house-model") return houseModels.find(model => model.title === targetId)?.authorId ?? "";
  if (requestedId) return requestedId;
  if (targetType === "expert") {
    const [profile] = await db.select({ id: virtualProfiles.id }).from(virtualProfiles).where(eq(virtualProfiles.displayName, targetId)).limit(1);
    return profile?.id ?? "";
  }
  return "";
}

export async function messageRecipientName(userId: string) {
  const db = getDb();
  const [member] = await db.select({ name: memberProfiles.displayName }).from(memberProfiles).where(eq(memberProfiles.userId, userId)).limit(1);
  if (member) return member.name;
  const [profile] = await db.select({ name: virtualProfiles.displayName }).from(virtualProfiles).where(eq(virtualProfiles.id, userId)).limit(1);
  return profile?.name ?? "Thành viên";
}
