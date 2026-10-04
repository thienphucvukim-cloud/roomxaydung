import { PublicProfile } from "@/components/public-profile";
export default async function PublicProfilePage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  return <PublicProfile id={id}/>;
}
