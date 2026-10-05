import { env } from "cloudflare:workers";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { postAttachments, posts } from "@/db/schema";
import { NEWS_SOURCES } from "@/lib/news-feed";
import { createShareJpeg } from "@/lib/share-image-codec";

const absent = () => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d*\.jpg$/.test(id) || !Number.isSafeInteger(Number(id.slice(0, -4)))) return absent();
  const version = new URL(request.url).searchParams.get("v");
  const bucket = env.BUCKET;
  if (!bucket) return new Response(null, { status: 503 });
  try {
    const [image] = await getDb().select({ key: postAttachments.objectKey, type: postAttachments.mimeType }).from(posts).innerJoin(postAttachments, eq(posts.id, postAttachments.postId)).where(and(
      eq(posts.id, Number(id.slice(0, -4))), eq(posts.audience, "Công khai"), inArray(posts.category, NEWS_SOURCES.map(source => source.category)),
      eq(postAttachments.accessType, "public"), inArray(postAttachments.mimeType, ["image/webp", "image/jpeg", "image/png", "image/gif"]),
    )).orderBy(asc(postAttachments.id)).limit(1);
    if (!image || (version && version !== image.key)) return absent();
    const source = await bucket.head(image.key);
    if (!source || source.customMetadata?.accessType === "private") return absent();
    const cachedKey = `share-previews/v1/${image.key}.jpg`;
    let object = await bucket.get(cachedKey);
    if (!object && request.method !== "HEAD") {
      if (source.size > 5 * 1024 * 1024) return new Response(null, { status: 413 });
      const original = await bucket.get(image.key);
      if (!original || original.customMetadata?.accessType === "private") return absent();
      const bytes = await createShareJpeg(new Uint8Array(await original.arrayBuffer()), image.type);
      await bucket.put(cachedKey, bytes, { httpMetadata: { contentType: "image/jpeg" } });
      object = await bucket.get(cachedKey);
    }
    if (!object && request.method !== "HEAD") throw new Error("Generated preview missing");
    const headers = new Headers({ "Content-Type": "image/jpeg", "Content-Disposition": `inline; filename="${id}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
    if (object) { headers.set("Content-Length", String(object.size)); headers.set("ETag", object.httpEtag); }
    return new Response(request.method === "HEAD" ? null : object?.body, { headers });
  } catch (error) {
    console.error("Share preview unavailable", error instanceof Error ? error.message : "Unknown error");
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } });
  }
}
export const HEAD = GET;
