import { permanentRedirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyPage({ searchParams }: PageProps) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach(item => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  permanentRedirect("/file-ban-ve-nha-dep-chat" + (query.size ? "?" + query.toString() : ""));
}
