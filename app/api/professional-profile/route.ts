import { eq } from "drizzle-orm";
import { currentMember } from "../../../lib/member-identity";
import { getDb } from "../../../db";
import { memberProfiles } from "../../../db/schema";

const professionalTypes = ["engineer", "architect"] as const;
type ProfessionalType = typeof professionalTypes[number];

export async function GET() {
  try {
    const member = await currentMember();
    const [profile] = await getDb().select().from(memberProfiles).where(eq(memberProfiles.userId, member.userId)).limit(1);
    return Response.json({ profile: profile ?? { ...member, accountType: "user", profession: null } });
  } catch {
    return Response.json({ error: "Chưa thể tải loại tài khoản." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { accountType?: unknown };
    if (typeof body.accountType !== "string" || !professionalTypes.includes(body.accountType as ProfessionalType)) return Response.json({ error: "Vui lòng chọn tài khoản Kỹ sư hoặc Kiến trúc sư." }, { status: 400 });
    const accountType = body.accountType as ProfessionalType;
    const member = await currentMember();
    const now = new Date().toISOString();
    const data = { ...member, accountType, profession: accountType === "engineer" ? "Kỹ sư" : "Kiến trúc sư", upgradedAt: now, updatedAt: now };
    await getDb().insert(memberProfiles).values(data).onConflictDoUpdate({ target: memberProfiles.userId, set: { displayName: data.displayName, email: data.email, accountType: data.accountType, profession: data.profession, upgradedAt: data.upgradedAt, updatedAt: data.updatedAt } });
    return Response.json({ profile: data });
  } catch {
    return Response.json({ error: "Chưa thể chuyển loại tài khoản." }, { status: 500 });
  }
}
