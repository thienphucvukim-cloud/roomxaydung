import type { Metadata } from "next";
import { AuthScreen } from "@/components/auth-screen";
import "../auth.css";

export const metadata: Metadata = { title: "Quên mật khẩu | Tipook", robots: { index: false, follow: false } };
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) { const params = await searchParams; return <AuthScreen recovery admin={params.role === "admin"}/>; }
