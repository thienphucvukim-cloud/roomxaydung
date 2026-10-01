import { env } from "cloudflare:workers";
import { hashToken } from "@/lib/password";

export class AuthFlowError extends Error {
  constructor(message: string, public status = 400, public retryAfter?: number) { super(message); }
}

export async function limitAuthAttempts(scope: string, limit: number, windowMs = 900_000) {
  const now = Date.now();
  const key = hashToken(`${scope}:${Math.floor(now / windowMs)}`);
  const row = await env.DB!.prepare("INSERT INTO auth_rate_limits (key, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 RETURNING attempts")
    .bind(key, now + windowMs).first<{ attempts: number }>();
  if (!row || row.attempts > limit) throw new AuthFlowError("Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.", 429, Math.ceil(windowMs / 1000));
}

export function requestIp(request: Request) { return request.headers.get("cf-connecting-ip") || "local"; }
