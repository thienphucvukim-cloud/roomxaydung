import { getAuthenticatedIdentity } from "@/lib/website-auth";

export const MEMBER_REQUIRED_MESSAGE = "Vui lòng đăng ký hoặc đăng nhập tài khoản để sử dụng chức năng này.";

export async function memberAccessResponse() {
  if (await getAuthenticatedIdentity()) return null;
  return Response.json({ error: MEMBER_REQUIRED_MESSAGE, code: "AUTH_REQUIRED" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
}
