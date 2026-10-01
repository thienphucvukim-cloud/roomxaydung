import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth-screen";
import { getAuthenticatedIdentity, isAdminIdentity, safeAuthReturn } from "@/lib/website-auth";
import "../auth.css";

export const metadata: Metadata = { title: "Đăng nhập | Tipook", robots: { index: false, follow: false } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ role?: string; return_to?: string }> }) {
  const params = await searchParams;
  const admin = params.role === "admin" || params.return_to?.startsWith("/quan-tri") || false;
  const returnTo = safeAuthReturn(params.return_to, "/kho-mau-nha-dep-tipook");
  const identity = await getAuthenticatedIdentity();
  if (identity && (!admin || isAdminIdentity(identity))) redirect(returnTo);
  return <AuthScreen admin={admin} returnTo={returnTo} notice={identity && admin ? "Tài khoản hiện tại chưa có quyền quản trị. Hãy đăng nhập bằng email quản trị." : ""}/>;
}
