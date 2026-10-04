import type { Metadata } from "next";
import { AuthPage } from "@/components/auth-page";
import "../auth.css";

export const metadata: Metadata = { title: "Tạo tài khoản | NhàĐẹpChất", robots: { index: false, follow: false } };
export default function RegisterPage() {
  return <AuthPage mode="register"/>;
}
