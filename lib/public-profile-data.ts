export type PublicProfileData = { displayName: string; avatarUrl?: string; profession: string; bio: string; location: string | null; own: boolean;
  authoredPosts: { slug?: string | null; id: number; userId: string; title: string; category: string; content: string; imageUrl: string | null }[] };
