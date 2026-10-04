export function safeAuthReturn(value: string | null | undefined, fallback = "/tai-khoan") {
  if (!value?.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "https://nhadepchat.local");
    if (url.origin !== "https://nhadepchat.local" || /^\/(?:api|admin|dang-nhap|dang-ky|quen-mat-khau|signin-with-chatgpt|signout-with-chatgpt|callback)(?:\/|$)/.test(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch { return fallback; }
}
