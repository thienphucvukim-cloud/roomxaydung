import { TinodeChat } from "@/components/tinode-chat";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const { user } = await searchParams;
  return <TinodeChat initialRecipient={user?.slice(0, 180) ?? ""}/>;
}
