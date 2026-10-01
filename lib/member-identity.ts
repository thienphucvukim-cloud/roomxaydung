import { headers } from "next/headers";
import { getPaymentBuyerId } from "./payment-identity";

export async function currentMember() {
  const userId = await getPaymentBuyerId();
  if (!userId) throw new Error("Phiên tài khoản đã hết hạn. Vui lòng tải lại trang.");
  const h = await headers();
  const email = h.get("oai-authenticated-user-email") || null;
  const encodedName = h.get("oai-authenticated-user-full-name");
  let displayName = email?.split("@")[0] || "Thành viên Tipook";
  if (encodedName && h.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8") {
    try { displayName = decodeURIComponent(encodedName); } catch { /* Use the email name. */ }
  }
  return { userId, email, displayName, authorName: displayName };
}

export async function currentUserId() {
  return (await currentMember()).userId;
}
