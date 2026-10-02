export const FACADE_BASE_PATH = "/kho-mau-nha-dep-chat";

export function facadePageHref(_page: number, query = "", sort: "random" | "views" | "featured" = "random") {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (sort !== "random") params.set("sort", sort);
  return params.size ? `${FACADE_BASE_PATH}?${params}` : FACADE_BASE_PATH;
}
