import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth-screen";
import { getAuthenticatedIdentity, safeAuthReturn } from "@/lib/website-auth";
import "../auth.css";

export const metadata: Metadata = { title: "Tạo tài khoản | NhàĐẹpChất", robots: { index: false, follow: false } };
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ return_to?: string; add_account?: string }> }) {
  const params = await searchParams;
  if (await getAuthenticatedIdentity() && params.add_account !== "1") redirect("/tai-khoan");
  return <AuthScreen register addingAccount={params.add_account === "1"} returnTo={safeAuthReturn(params.return_to)}/>;
}
