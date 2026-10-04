import { safeAuthReturn } from "./auth-return";

export function authActionTarget(targetType?: string, targetId?: string) {
  return {
    "data-auth-post-id": targetType === "post" ? targetId : undefined,
    "data-auth-model-query": targetType === "drawing" || targetType === "house-model" ? targetId : undefined,
  };
}

export function modelAuthAnchor(title: string) { return "model-" + encodeURIComponent(title); }

/** Resolve the card that triggered the account prompt, including portal content. */
export function actionAuthReturn(href: string, postId?: string | null, modelQuery?: string | null) {
  const current = new URL(href, "https://nhadepchat.local");
  const catalog = current.pathname.match(/^\/(kho-mau-nha-dep-chat|file-ban-ve-nha-dep-chat|noi-that)(?:\/page\/\d+)?$/);
  if (postId && /^[1-9]\d*$/.test(postId) && Number.isSafeInteger(Number(postId))) {
    if (!catalog) return `/bai-viet/${postId}#post-${postId}`;
    current.pathname = "/" + catalog[1];
    current.searchParams.delete("page");
    current.searchParams.set("postId", postId);
    current.hash = `post-${postId}`;
  } else if (modelQuery && catalog) {
    current.pathname = "/" + catalog[1];
    current.searchParams.delete("page");
    current.searchParams.delete("postId");
    current.searchParams.set("q", modelQuery.slice(0, 120));
    current.hash = modelAuthAnchor(modelQuery);
  }
  return safeAuthReturn(current.pathname + current.search + current.hash, "/");
}
