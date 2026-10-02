import { createHash } from "node:crypto";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_KEYS_URL = "https://www.googleapis.com/oauth2/v3/certs";

export function googleAuthorizationUrl(clientId: string, redirectUri: string, state: string, verifier: string, nonce: string) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state, nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", prompt: "select_account" }).toString();
  return url.toString();
}

type GoogleKey = JsonWebKey & { kid?: string };
export type GoogleProfile = { sub: string; email: string; name?: string; picture?: string };

export function googlePictureUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

// Verify the signature and all login claims before trusting profile information.
export async function verifyGoogleIdToken(token: string, clientId: string, nonce: string, keys: GoogleKey[], now = Date.now()): Promise<GoogleProfile> {
  if (token.length > 16384) throw new Error("Invalid Google token.");
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error("Invalid Google token.");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Invalid Google signing algorithm.");
  const jwk = keys.find(key => key.kid === header.kid && key.kty === "RSA" && (!key.use || key.use === "sig") && (!key.alg || key.alg === "RS256"));
  if (!jwk) throw new Error("Unknown Google signing key.");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const signature = Uint8Array.from(Buffer.from(parts[2], "base64url"));
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) throw new Error("Invalid Google signature.");
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!["https://accounts.google.com", "accounts.google.com"].includes(claims.iss)
    || !audience.includes(clientId) || (audience.length > 1 && claims.azp !== clientId) || (claims.azp !== undefined && claims.azp !== clientId)
    || typeof claims.exp !== "number" || claims.exp <= now / 1000
    || typeof claims.iat !== "number" || claims.iat > now / 1000 + 60
    || claims.nonce !== nonce || typeof claims.sub !== "string" || !/^[A-Za-z0-9_-]{1,255}$/.test(claims.sub)
    || claims.email_verified !== true || typeof claims.email !== "string" || claims.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)) throw new Error("Invalid Google login claims.");
  const picture = googlePictureUrl(claims.picture);
  return { sub: claims.sub, email: claims.email.trim().toLowerCase(), ...(typeof claims.name === "string" ? { name: claims.name } : {}), ...(picture ? { picture } : {}) };
}
