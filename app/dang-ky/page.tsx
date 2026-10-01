import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth-screen";
import { getAuthenticatedIdentity, safeAuthReturn } from "@/lib/website-auth";
import "../auth.css";

export const metadata: Metadata = { title: "Tạo tài khoản | Tipook", robots: { index: false, follow: false } };
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const params = await searchParams;
  if (await getAuthenticatedIdentity()) redirect("/tai-khoan");
  return <AuthScreen register returnTo={safeAuthReturn(params.return_to)}/>;
}
