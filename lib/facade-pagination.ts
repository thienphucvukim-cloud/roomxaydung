import { catalogPageHref } from "./catalog-pagination";
export { CATALOG_PAGE_SIZE as FACADE_PAGE_SIZE, catalogPageWindow as facadePageWindow } from "./catalog-pagination";
export const FACADE_BASE_PATH = "/kho-mau-nha-dep-tipook";

export function facadePageHref(page: number, query = "") {
  return catalogPageHref(FACADE_BASE_PATH, page, query);
}
