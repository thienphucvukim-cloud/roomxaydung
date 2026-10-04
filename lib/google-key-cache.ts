import { GOOGLE_KEYS_URL } from "@/lib/google-oauth";

type GoogleKey = JsonWebKey & { kid?: string };

// Only Google's public signing keys are cached. Login tokens, claims, nonce
// and sessions are always verified afresh for each callback.
export function createGoogleKeyCache(fetchKeys: typeof fetch = fetch, now = Date.now) {
  let cached: { keys: GoogleKey[]; expiresAt: number } | undefined;
  let pending: Promise<GoogleKey[]> | undefined;
  async function get(refresh = false): Promise<GoogleKey[]> {
    if (!refresh && cached && cached.expiresAt > now()) return cached.keys;
    if (pending) return pending;
    pending = (async () => {
      const response = await fetchKeys(GOOGLE_KEYS_URL, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("Cannot retrieve Google signing keys.");
      const data = await response.json() as { keys?: GoogleKey[] };
      if (!Array.isArray(data.keys) || !data.keys.length || data.keys.length > 20
        || data.keys.some(key => key.kty !== "RSA" || typeof key.kid !== "string")) throw new Error("Invalid Google signing keys.");
      const directives = response.headers.get("cache-control") || "";
      const maxAge = Number(directives.match(/(?:^|,)\s*max-age\s*=\s*(\d+)/i)?.[1] || 0);
      const age = Number(response.headers.get("age") || 0);
      const seconds = /(?:^|,)\s*(?:no-store|no-cache)\b/i.test(directives) || !Number.isFinite(age)
        ? 0 : Math.max(0, Math.min(21600, maxAge - Math.max(0, age)));
      cached = { keys: data.keys, expiresAt: now() + seconds * 1000 };
      return data.keys;
    })();
    try { return await pending; }
    finally { pending = undefined; }
  }
  async function forToken(token: string, keys: GoogleKey[]) {
    if (token.length > 16384) throw new Error("Invalid Google token.");
    const part = token.split(".")[0];
    if (!part || !/^[A-Za-z0-9_-]+$/.test(part)) throw new Error("Invalid Google token.");
    const header = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Invalid Google signing algorithm.");
    if (keys.some(key => key.kid === header.kid)) return keys;
    if (cached && cached.expiresAt > now() && cached.keys.some(key => key.kid === header.kid)) return cached.keys;
    // Google can rotate keys before the cached set expires. Refresh once for
    // a new kid, then let signature verification reject an unknown key.
    return get(true);
  }
  return { get: () => get(), forToken };
}

export const googleKeyCache = createGoogleKeyCache();
