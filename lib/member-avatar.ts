export function memberAvatarUrl(profile?: { avatarKey?: string | null; googleAvatarUrl?: string | null } | null) {
  return profile?.avatarKey ? `/api/files?key=${encodeURIComponent(profile.avatarKey)}` : profile?.googleAvatarUrl || null;
}

export function avatarInitial(name: string) {
  const givenName = name.trim().normalize("NFC").split(/\s+/).pop() || "";
  return Array.from(givenName)[0]?.toLocaleUpperCase("vi-VN") || "?";
}
