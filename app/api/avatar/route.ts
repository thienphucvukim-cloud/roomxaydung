import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { memberProfiles } from "@/db/schema";
import { getAuthenticatedIdentity, validOrigin } from "@/lib/website-auth";
import { memberAvatarUrl } from "@/lib/member-avatar";
import { validateOptimizedImage } from "@/lib/image-upload-policy";

export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const identity = await getAuthenticatedIdentity();
  if (!identity) return Response.json({ error: "Vui lòng đăng nhập để đổi ảnh đại diện." }, { status: 401 });
  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return Response.json({ error: "Vui lòng chọn ảnh đại diện." }, { status: 400 });
    const invalid = await validateOptimizedImage(file, "avatar");
    if (invalid) return Response.json({ error: invalid.error }, { status: invalid.status });
    if (!env.BUCKET) return Response.json({ error: "Kho ảnh chưa được cấu hình." }, { status: 503 });
    const key = crypto.randomUUID();
    await env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: "image/webp" }, customMetadata: { accessType: "public", ownerUserId: identity.userId, fileName: "avatar.webp" } });
    const db = getDb();
    try {
      await db.insert(memberProfiles).values({ userId: identity.userId, displayName: identity.displayName, email: identity.email, avatarKey: key })
        .onConflictDoUpdate({ target: memberProfiles.userId, set: { avatarKey: key, updatedAt: new Date().toISOString() } });
    } catch (error) {
      await env.BUCKET.delete(key);
      throw error;
    }
    return Response.json({ avatarUrl: memberAvatarUrl({ avatarKey: key }), hasCustomAvatar: true });
  } catch {
    return Response.json({ error: "Chưa thể lưu ảnh đại diện. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const identity = await getAuthenticatedIdentity();
  if (!identity) return Response.json({ error: "Vui lòng đăng nhập để đổi ảnh đại diện." }, { status: 401 });
  try {
    const [profile] = await getDb().update(memberProfiles).set({ avatarKey: null, updatedAt: new Date().toISOString() })
      .where(eq(memberProfiles.userId, identity.userId)).returning({ googleAvatarUrl: memberProfiles.googleAvatarUrl });
    return Response.json({ avatarUrl: memberAvatarUrl(profile), hasCustomAvatar: false });
  } catch {
    return Response.json({ error: "Chưa thể xóa ảnh đại diện. Vui lòng thử lại." }, { status: 500 });
  }
}
