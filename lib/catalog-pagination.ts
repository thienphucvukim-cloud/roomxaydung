export const CATALOG_PAGE_SIZE = 20;

export function drawingPostHref(postId: number) {
  return `/file-ban-ve-nha-dep-chat?postId=${postId}#post-${postId}`;
}

export function catalogPageHref(basePath: string, page: number, query = "", sort = "latest") {
  const path = `${basePath}/page/${page}`;
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (sort !== "latest") params.set("sort", sort);
  return params.size ? `${path}?${params.toString()}` : path;
}

export function catalogPageWindow(page: number, postCount: number, modelCount: number, pageSize = CATALOG_PAGE_SIZE) {
  const offset = (page - 1) * pageSize;
  const postsOnPage = Math.min(pageSize, Math.max(0, postCount - offset));
  const modelStart = Math.max(0, offset - postCount);
  return {
    total: postCount + modelCount,
    totalPages: Math.max(1, Math.ceil((postCount + modelCount) / pageSize)),
    modelStart,
    modelEnd: modelStart + pageSize - postsOnPage,
  };
}
