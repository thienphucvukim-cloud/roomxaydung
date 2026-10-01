import { getDb } from "@/db";
import { websiteContent } from "@/db/schema";

export type ContentValue = { kind: "text" | "image" | "color"; value: string };
export type SiteContent = Record<string, ContentValue>;
export async function getSiteContent(): Promise<SiteContent> {
  try {
    const rows = await getDb().select({ key: websiteContent.key, kind: websiteContent.kind, value: websiteContent.value }).from(websiteContent);
    return Object.fromEntries(rows.map(row => [row.key, { kind: row.kind as ContentValue["kind"], value: row.value }]));
  } catch { return {}; }
}
