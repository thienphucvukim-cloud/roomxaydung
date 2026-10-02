import { getAuthenticatedIdentity } from "./website-auth";

export async function currentMember() {
  const identity = await getAuthenticatedIdentity();
  if (!identity) throw new Error("Vui lòng đăng ký hoặc đăng nhập tài khoản.");
  const userId = identity.userId;
  const email = identity.email || null;
  const displayName = identity.displayName;
  return { userId, email, displayName, authorName: displayName };
}

export async function currentUserId() {
  return (await currentMember()).userId;
}
