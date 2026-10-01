import type { Metadata } from "next";
import { AuthScreen } from "@/components/auth-screen";
import "../auth.css";

export const metadata: Metadata = { title: "Quên mật khẩu | Tipook", robots: { index: false, follow: false } };
export default function ForgotPasswordPage() { return <AuthScreen recovery/>; }
