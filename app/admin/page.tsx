import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth-screen";
import { getAuthenticatedIdentity, isAdminIdentity, safeAuthReturn } from "@/lib/website-auth";
import "../auth.css";

export const metadata: Metadata = { title: "Đăng nhập quản trị | Tipook", robots: { index: false, follow: false } };
export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ return_to?: string; auth_error?: string; recovery?: string; add_account?: string }> }) {
  const params = await searchParams;
  const returnTo = safeAuthReturn(params.return_to, "/kho-mau-nha-dep-chat");
  const identity = await getAuthenticatedIdentity();
  if (isAdminIdentity(identity) && params.add_account !== "1") redirect(returnTo);
  return <AuthScreen admin recovery={params.recovery === "1"} returnTo={returnTo} notice={identity ? "Tài khoản hiện tại chưa có quyền quản trị. Hãy đăng nhập bằng email quản trị." : params.auth_error?.slice(0, 300) || ""}/>;
}
