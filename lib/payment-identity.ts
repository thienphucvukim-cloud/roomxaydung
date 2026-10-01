import { cookies, headers } from "next/headers";
import { GUEST_ID_PATTERN, MEMBER_SESSION_COOKIE as PAYMENT_SESSION_COOKIE } from "./session-cookie";

export async function getPaymentBuyerId() {
  const authenticatedId = (await headers()).get("oai-authenticated-user-id")?.trim();
  if (authenticatedId) return authenticatedId.slice(0, 180);
  const value = (await cookies()).get(PAYMENT_SESSION_COOKIE)?.value ?? "";
  return GUEST_ID_PATTERN.test(value) ? value : null;
}

export async function getOrCreatePaymentBuyerId() {
  const existing = await getPaymentBuyerId();
  if (existing) return { userId: existing, isNew: false };
  return { userId: "guest_" + crypto.randomUUID(), isNew: true };
}

export function attachPaymentBuyerCookie(response: Response, request: Request, userId: string) {
  if (!GUEST_ID_PATTERN.test(userId)) return response;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  response.headers.append("Set-Cookie", PAYMENT_SESSION_COOKIE + "=" + userId + "; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax" + secure);
  return response;
}
