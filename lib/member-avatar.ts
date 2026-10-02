export function memberAvatarUrl(profile?: { avatarKey?: string | null; googleAvatarUrl?: string | null } | null) {
  return profile?.avatarKey ? `/api/files?key=${encodeURIComponent(profile.avatarKey)}` : profile?.googleAvatarUrl || null;
}

export function avatarInitial(name: string) {
  const trimmed = name.trim().normalize("NFC");
  return Array.from(trimmed)[0]?.toLocaleUpperCase("vi-VN") || "?";
}
