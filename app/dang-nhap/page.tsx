import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth-screen";
import { getAuthenticatedIdentity, safeAuthReturn } from "@/lib/website-auth";
import "../auth.css";

export const metadata: Metadata = { title: "Đăng nhập | Tipook", robots: { index: false, follow: false } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ role?: string; return_to?: string; auth_error?: string; add_account?: string }> }) {
  const params = await searchParams;
  const admin = params.role === "admin" || params.return_to?.startsWith("/quan-tri") || false;
  if (admin) {
    const query = new URLSearchParams();
    if (params.return_to) query.set("return_to", params.return_to);
    if (params.auth_error) query.set("auth_error", params.auth_error.slice(0, 300));
    if (params.add_account === "1") query.set("add_account", "1");
    redirect(`/admin${query.size ? `?${query}` : ""}`);
  }
  const returnTo = safeAuthReturn(params.return_to, "/kho-mau-nha-dep-chat");
  const identity = await getAuthenticatedIdentity();
  if (identity && params.add_account !== "1") redirect(returnTo);
  return <AuthScreen addingAccount={params.add_account === "1"} returnTo={returnTo} notice={params.auth_error?.slice(0, 300) || ""}/>;
}
