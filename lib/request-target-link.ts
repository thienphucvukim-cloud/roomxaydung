export function requestTargetLink(origin: string, targetType: string, targetId: string, category?: string) {
  const basePath = category === "Nội thất cộng đồng" ? "/noi-that" : "/file-ban-ve-nha-dep-chat";
  if (targetType === "post") {
    const url = new URL(basePath, origin);
    url.searchParams.set("postId", targetId);
    url.hash = `post-${targetId}`;
    return url.href;
  }
  const url = new URL(`${basePath}/page/1`, origin);
  url.searchParams.set("q", targetId);
  return url.href;
}
