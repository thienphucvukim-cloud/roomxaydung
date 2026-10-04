import { PublicProfile } from "@/components/public-profile";
import { publicProfile } from "@/lib/seo-data";
import { canonicalUrl, pageMetadata } from "@/lib/seo";
import { StructuredData } from "@/components/structured-data";
import { notFound } from "next/navigation";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, result = await publicProfile(id);
  if (result === null) notFound();
  return result ? { ...pageMetadata(`${result.profile.displayName} — ${result.profile.profession}`, result.profile.bio, `/nguoi-dung/${encodeURIComponent(id)}`, result.profile.avatarUrl ? [result.profile.avatarUrl] : []),
    robots: { index: result.indexable, follow: true } } : {};
}
export default async function PublicProfilePage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const result = await publicProfile(id);
  if (result === null) notFound();
  const profile = result?.profile;
  return <>{result?.indexable && profile && <StructuredData value={{ "@context": "https://schema.org", "@type": "ProfilePage", url: canonicalUrl(`/nguoi-dung/${encodeURIComponent(id)}`),
    mainEntity: { "@type": "Person", name: profile.displayName, description: profile.bio, url: canonicalUrl(`/nguoi-dung/${encodeURIComponent(id)}`), ...(profile.avatarUrl ? { image: new URL(profile.avatarUrl, "https://nhadepchat.top").href } : {}) } }}/>}<PublicProfile id={id} initialProfile={profile}/></>;
}
