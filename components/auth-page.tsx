"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AuthScreen } from "@/components/auth-screen";
import { safeAuthReturn } from "@/lib/auth-return";

type Mode = "login" | "register" | "admin" | "recovery";
type Options = { admin: boolean; register: boolean; recovery: boolean; addingAccount: boolean; returnTo: string; notice: string };
// Only the form shell is static. Session checks and all authentication actions
// use uncached APIs, so sharing the HTML never shares an account or permissions.
export function AuthPage({ mode }: { mode: Mode }) {
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const [options, setOptions] = useState<Options | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(window.location.search);
    const addingAccount = params.get("add_account") === "1";
    const returnTo = safeAuthReturn(params.get("return_to"), mode === "register" ? "/tai-khoan" : "/kho-mau-nha-dep-chat");
    if (mode === "login" && (params.get("role") === "admin" || params.get("return_to")?.startsWith("/quan-tri"))) {
      params.delete("role");
      window.location.replace("/admin" + (params.size ? "?" + params : ""));
      return;
    }
    if (mode === "recovery" && params.get("role") === "admin") {
      window.location.replace("/admin?recovery=1");
      return;
    }
    fetch("/api/me", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Chưa thể kiểm tra tài khoản. Vui lòng thử lại.");
      return response.json() as Promise<{ user?: { isAdmin?: boolean } | null }>;
    }).then(({ user }) => {
      if (controller.signal.aborted) return;
      if (user && !addingAccount && (mode === "login" || mode === "register" || (mode === "admin" && user.isAdmin))) {
        router.replace(returnTo);
        return;
      }
      setOptions({ admin: mode === "admin", register: mode === "register", recovery: mode === "recovery" || (mode === "admin" && params.get("recovery") === "1"), addingAccount, returnTo,
        notice: mode === "admin" && user ? "Tài khoản hiện tại chưa có quyền quản trị. Hãy đăng nhập bằng email quản trị." : (params.get("auth_error") ?? "").slice(0, 300) });
      setError("");
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Chưa thể kiểm tra tài khoản."); });
    return () => controller.abort();
  }, [mode, pathname, query, revision, router]);
  if (!options) return <main className="grid min-h-screen place-items-center bg-[#f4f7fb] p-6 text-[#0b2e59]"><div role={error ? "alert" : "status"}>{error || "Đang mở trang tài khoản…"}{error && <button className="ml-3 underline" onClick={() => setRevision(value => value + 1)}>Thử lại</button>}</div></main>;
  return <AuthScreen {...options}/>;
}
