import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth-screen";
import "../auth.css";

export const metadata: Metadata = { title: "Quên mật khẩu | Tipook", robots: { index: false, follow: false } };
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const params = await searchParams;
  if (params.role === "admin") redirect("/admin?recovery=1");
  return <AuthScreen recovery/>;
}
