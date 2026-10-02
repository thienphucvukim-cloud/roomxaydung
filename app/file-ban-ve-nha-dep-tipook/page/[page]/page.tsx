import { notFound, permanentRedirect } from "next/navigation";

type PageProps = {
  params: Promise<{ page: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyPage({ params, searchParams }: PageProps) {
  const { page } = await params;
  if (!/^[1-9]\d*$/.test(page) || Number(page) > 1000000) notFound();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach(item => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  permanentRedirect(`/file-ban-ve-nha-dep-chat/page/${page}` + (query.size ? "?" + query.toString() : ""));
}
