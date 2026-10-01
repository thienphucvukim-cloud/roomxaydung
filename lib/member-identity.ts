import { getAuthenticatedIdentity } from "./website-auth";
import { getPaymentBuyerId } from "./payment-identity";

export async function currentMember() {
  const userId = await getPaymentBuyerId();
  if (!userId) throw new Error("Phiên tài khoản đã hết hạn. Vui lòng tải lại trang.");
  const identity = await getAuthenticatedIdentity();
  const email = identity?.email || null;
  const displayName = identity?.displayName || "Thành viên Tipook";
  return { userId, email, displayName, authorName: displayName };
}

export async function currentUserId() {
  return (await currentMember()).userId;
}
