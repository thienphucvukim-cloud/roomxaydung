// These pages contain public UI only. Live data is loaded through APIs after
// hydration; they can be generated without a database, secrets or user cookies.
export const STATIC_SHELL_PATHS = [
  "/", "/dang-nhap", "/dang-ky", "/admin", "/quen-mat-khau", "/tai-khoan",
  "/thue-thiet-ke", "/nhat-ky-xay-nha", "/cam-nang", "/mat-bang-cong-nang",
  "/hoi-chuyen-gia", "/tinh-vat-tu-nha-dep-chat", "/gioi-thieu", "/privacy", "/tim-kiem",
  "/kho-mau-nha-dep-chat", "/file-ban-ve-nha-dep-chat", "/noi-that",
] as const;
// Detail pages load their records through authenticated/public APIs. The only
// per-request substitution in their public UI is a validated URL identifier.
export const STATIC_SHELL_TEMPLATES = [
  { prefix: "/bai-viet/", marker: "918273645012", numeric: true },
  { prefix: "/thue-thiet-ke/freelancer/", marker: "__nhadepchat_shell_id__", numeric: false },
  { prefix: "/thue-thiet-ke/", marker: "__nhadepchat_shell_id__", numeric: false },
  { prefix: "/nguoi-dung/", marker: "__nhadepchat_shell_id__", numeric: false },
] as const;
export function shellAssetPath(pathname: string, rsc = false, navigation = false) {
  return "/_shells/" + (pathname === "/" ? "home" : pathname.slice(1)) + (rsc ? navigation ? ".nav.rsc" : ".rsc" : ".html");
}
