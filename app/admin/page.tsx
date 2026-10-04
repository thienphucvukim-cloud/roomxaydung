import type { Metadata } from "next";
import { AuthPage } from "@/components/auth-page";
import "../auth.css";

export const metadata: Metadata = { title: "Đăng nhập quản trị | NhàĐẹpChất", robots: { index: false, follow: false } };
export default function AdminLoginPage() {
  return <AuthPage mode="admin"/>;
}
