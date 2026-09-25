import { and, count, desc, eq, inArray, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../db";
import { postAttachments, posts, userActions } from "../../../db/schema";

type AttachmentInput = {
  key?: string;
  name?: string;
  type?: string;
  size?: number;
};

function publicAttachment(attachment: { id?: number; objectKey: string; fileName: string; mimeType: string; size: number }) {
  return {
    id: attachment.id,
    key: attachment.objectKey,
    name: attachment.fileName,
    type: attachment.mimeType,
    size: attachment.size,
    url: "/api/files?key=" + encodeURIComponent(attachment.objectKey),
  };
}

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select().from(posts).where(ne(posts.category, "Thảo luận mẫu nhà")).orderBy(desc(posts.createdAt), desc(posts.id)).limit(30);
    let attachmentRows: Array<typeof postAttachments.$inferSelect> = [];
    let shareRows: Array<{ targetId: string; value: number }> = [];
    if (rows.length) {
      try {
        attachmentRows = await db.select().from(postAttachments).where(inArray(postAttachments.postId, rows.map((post) => post.id)));
        const ids = rows.map((post) => String(post.id));
        shareRows = await db.select({ targetId: userActions.targetId, value: count() }).from(userActions).where(and(eq(userActions.actionType, "share"), eq(userActions.targetType, "post"), inArray(userActions.targetId, ids))).groupBy(userActions.targetId);
      } catch {
        attachmentRows = [];
      }
    }
    const byPost = new Map<number, ReturnType<typeof publicAttachment>[]>();
    for (const attachment of attachmentRows) {
      const current = byPost.get(attachment.postId) ?? [];
      current.push(publicAttachment(attachment));
      byPost.set(attachment.postId, current);
    }
    const shares = new Map(shareRows.map((row) => [row.targetId, row.value]));
    return Response.json({ posts: rows.map((post) => ({ ...post, attachments: byPost.get(post.id) ?? [], shares: shares.get(String(post.id)) ?? 0 })) });
  } catch {
    return Response.json({ posts: [] });
  }
}

export async function POST(request: Request) {
  try {
    const h = await headers();
    const userId = h.get("oai-authenticated-user-id");
    const email = h.get("oai-authenticated-user-email");
    const encodedName = h.get("oai-authenticated-user-full-name");
    const authorName = encodedName && h.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8" ? decodeURIComponent(encodedName) : email?.split("@")[0] ?? "Thành viên mới";
    const body = await request.json() as { title?: string; content?: string; category?: string; location?: string; audience?: string; feeling?: string; background?: string; mentions?: string[]; pollQuestion?: string; pollOptions?: string[]; attachments?: AttachmentInput[] };
    const title = body.title?.trim() ?? "";
    const content = body.content?.trim() ?? "";
    if (!title || !content) return Response.json({ error: "Vui lòng nhập tiêu đề và nội dung." }, { status: 400 });
    if (title.length > 120 || content.length > 1200) return Response.json({ error: "Nội dung vượt quá độ dài cho phép." }, { status: 400 });

    const attachments = (body.attachments ?? []).slice(0, 10).filter((attachment) =>
      typeof attachment.key === "string" &&
      /^[0-9a-f-]{36}$/i.test(attachment.key) &&
      typeof attachment.name === "string" &&
      attachment.name.length > 0 &&
      attachment.name.length <= 255 &&
      typeof attachment.size === "number" &&
      attachment.size > 0 &&
      attachment.size <= 25 * 1024 * 1024
    );

    const db = getDb();
    const [post] = await db.insert(posts).values({
      userId: userId ?? "private-member",
      authorName,
      category: body.category || "Chuẩn bị xây",
      title,
      content,
      location: body.location?.trim() || null,
      audience: body.audience?.slice(0, 40) || "Công khai",
      feeling: body.feeling?.slice(0, 80) || null,
      background: body.background?.slice(0, 40) || null,
      mentions: body.mentions?.slice(0, 10).join(",") || null,
      pollQuestion: body.pollQuestion?.trim().slice(0, 240) || null,
      pollOptions: body.pollOptions?.map((option) => option.trim()).filter(Boolean).slice(0, 6).join("|") || null,
    }).returning();

    let savedAttachments: ReturnType<typeof publicAttachment>[] = [];
    if (attachments.length) {
      const inserted = await db.insert(postAttachments).values(attachments.map((attachment) => ({
        postId: post.id,
        objectKey: attachment.key as string,
        fileName: attachment.name as string,
        mimeType: attachment.type?.slice(0, 120) || "application/octet-stream",
        size: attachment.size as number,
      }))).returning();
      savedAttachments = inserted.map(publicAttachment);
    }

    return Response.json({ post: { ...post, attachments: savedAttachments } }, { status: 201 });
  } catch {
    return Response.json({ error: "Chưa thể đăng bài lúc này. Vui lòng thử lại." }, { status: 500 });
  }
}
