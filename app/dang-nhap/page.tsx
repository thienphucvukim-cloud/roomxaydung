import type { Metadata } from "next";
import { AuthPage } from "@/components/auth-page";
import "../auth.css";

export const metadata: Metadata = { title: "Đăng nhập | NhàĐẹpChất", robots: { index: false, follow: false } };
export default function LoginPage() {
  return <AuthPage mode="login"/>;
}
