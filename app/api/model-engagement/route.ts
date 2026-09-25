import { and, count, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { postComments, posts, userActions, userRequests } from "../../../db/schema";

const discussionCategory = "Thảo luận mẫu nhà";

export async function GET(request: Request) {
  const targetId = new URL(request.url).searchParams.get("targetId")?.trim() ?? "";
  if (!targetId) return Response.json({ error: "Mẫu nhà không hợp lệ." }, { status: 400 });
  try {
    const db = getDb();
    const [discussion] = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.category, discussionCategory), eq(posts.title, targetId))).limit(1);
    const [commentRow] = discussion
      ? await db.select({ value: count() }).from(postComments).where(eq(postComments.postId, discussion.id))
      : [{ value: 0 }];
    const [shareRow] = await db.select({ value: count() }).from(userActions).where(and(eq(userActions.actionType, "share"), eq(userActions.targetType, "house-model"), eq(userActions.targetId, targetId)));
    const [expertRow] = await db.select({ value: count() }).from(userRequests).where(and(eq(userRequests.requestType, "expert-question"), eq(userRequests.targetType, "house-model"), eq(userRequests.targetId, targetId)));
    return Response.json({ comments: commentRow?.value ?? 0, shares: shareRow?.value ?? 0, expertQuestions: expertRow?.value ?? 0 });
  } catch {
    return Response.json({ comments: 0, shares: 0, expertQuestions: 0 });
  }
}
