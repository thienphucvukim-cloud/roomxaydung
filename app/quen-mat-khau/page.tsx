import type { Metadata } from "next";
import { AuthPage } from "@/components/auth-page";
import "../auth.css";

export const metadata: Metadata = { title: "Quên mật khẩu | NhàĐẹpChất", robots: { index: false, follow: false } };
export default function ForgotPasswordPage() {
  return <AuthPage mode="recovery"/>;
}
