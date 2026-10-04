export const HOUSE_MODEL_BASE_PATH = "/kho-mau-nha-dep-chat";

export function houseModelHref(query = "", sort: "random" | "views" | "featured" = "random") {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (sort !== "random") params.set("sort", sort);
  return params.size ? `${HOUSE_MODEL_BASE_PATH}?${params}` : HOUSE_MODEL_BASE_PATH;
}
