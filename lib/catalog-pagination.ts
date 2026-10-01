export const CATALOG_PAGE_SIZE = 20;

export function catalogPageHref(basePath: string, page: number, query = "") {
  const path = `${basePath}/page/${page}`;
  return query.trim() ? `${path}?q=${encodeURIComponent(query.trim())}` : path;
}

export function catalogPageWindow(page: number, postCount: number, modelCount: number) {
  const offset = (page - 1) * CATALOG_PAGE_SIZE;
  const postsOnPage = Math.min(CATALOG_PAGE_SIZE, Math.max(0, postCount - offset));
  const modelStart = Math.max(0, offset - postCount);
  return {
    total: postCount + modelCount,
    totalPages: Math.max(1, Math.ceil((postCount + modelCount) / CATALOG_PAGE_SIZE)),
    modelStart,
    modelEnd: modelStart + CATALOG_PAGE_SIZE - postsOnPage,
  };
}
