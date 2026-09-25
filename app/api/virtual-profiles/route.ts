import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { virtualProfiles } from "../../../db/schema";

export async function GET(request: Request) {
  try {
    const type = new URL(request.url).searchParams.get("type");
    const db = getDb();
    const query = db.select().from(virtualProfiles);
    const profiles = type === "member" || type === "expert"
      ? await query.where(eq(virtualProfiles.accountType, type)).orderBy(asc(virtualProfiles.displayName)).limit(50)
      : await query.orderBy(asc(virtualProfiles.accountType), asc(virtualProfiles.displayName)).limit(50);
    return Response.json({ profiles });
  } catch {
    return Response.json({ error: "Chưa thể tải danh sách hồ sơ mô phỏng." }, { status: 500 });
  }
}