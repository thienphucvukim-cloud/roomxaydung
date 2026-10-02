import { cookies } from "next/headers";
import { getAuthenticatedIdentity } from "./website-auth";
import { GUEST_ID_PATTERN, MEMBER_SESSION_COOKIE as PAYMENT_SESSION_COOKIE } from "./session-cookie";

export async function getPaymentBuyerId() {
  const authenticatedId = (await getAuthenticatedIdentity())?.userId;
  return authenticatedId ? authenticatedId.slice(0, 180) : null;
}

export async function getOrCreatePaymentBuyerId() {
  const existing = await getPaymentBuyerId();
  if (existing) return { userId: existing, isNew: false };
  // Anonymous IDs are only for counting visits, never account permissions.
  const visitor = (await cookies()).get(PAYMENT_SESSION_COOKIE)?.value ?? "";
  if (GUEST_ID_PATTERN.test(visitor)) return { userId: visitor, isNew: false };
  return { userId: "guest_" + crypto.randomUUID(), isNew: true };
}

export function attachPaymentBuyerCookie(response: Response, request: Request, userId: string) {
  if (!GUEST_ID_PATTERN.test(userId)) return response;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  response.headers.append("Set-Cookie", PAYMENT_SESSION_COOKIE + "=" + userId + "; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax" + secure);
  return response;
}
