export type AdminPost = { id: number; title: string; content: string; authorName: string; category: string; audience: string; createdAt: string };
export type AdminRequest = { id: number; subject: string; content: string; authorName: string; contact: string | null; requestType: string; status: string; createdAt: string };
export type AdminMember = { userId: string; displayName: string; email: string | null; accountType: string; profession: string | null; updatedAt: string; postCount: number };
export const requestStatuses = { pending: "Chờ xử lý", processing: "Đang xử lý", completed: "Hoàn thành", rejected: "Từ chối" };
export function adminDate(value: string) { return new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }); }
