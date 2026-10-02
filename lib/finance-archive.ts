import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export type FinanceArchiveEnv = { DB: D1Database; FINANCE_BACKUPS: R2Bucket; DATABASE_ID: string };
type Cursor = { lastEventId: number; lastChunkKey: string | null; lastSha256: string | null };
type AuditEvent = { id: number; table_name: string; record_key: string; operation: string; old_payload: string | null; new_payload: string; recorded_at: string };

export async function archiveFinance(env: FinanceArchiveEnv) {
  try {
    // Bound work per cron invocation; a backlog is picked up by the next run.
    for (let page = 0; page < 8; page++) {
      const [state, rows] = await env.DB.batch([
        env.DB.prepare("SELECT last_event_id AS lastEventId, last_chunk_key AS lastChunkKey, last_sha256 AS lastSha256 FROM finance_backup_state WHERE id = 1"),
        env.DB.prepare("SELECT * FROM finance_audit_events WHERE id > (SELECT last_event_id FROM finance_backup_state WHERE id = 1) ORDER BY id LIMIT 250"),
      ]);
      const cursor = state.results[0] as Cursor | undefined;
      if (!cursor) throw new Error("Missing financial archive checkpoint");
      const events = rows.results as AuditEvent[];
      const now = new Date().toISOString();
      if (!events.length) {
        await env.DB.prepare("UPDATE finance_backup_state SET last_checked_at = ?, last_error = NULL WHERE id = 1").bind(now).run();
        return;
      }
      const lastId = events[events.length - 1].id;
      // Deterministic content supports retries and independent integrity checks.
      const body = JSON.stringify({ version: 1, databaseId: env.DATABASE_ID, fromExclusive: cursor.lastEventId, toInclusive: lastId, previousChunkKey: cursor.lastChunkKey, previousSha256: cursor.lastSha256, events });
      const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body))), byte => byte.toString(16).padStart(2, "0")).join("");
      const key = `finance/v1/${String(cursor.lastEventId + 1).padStart(16, "0")}-${String(lastId).padStart(16, "0")}-${sha256}.json`;
      const existing = await env.FINANCE_BACKUPS.head(key);
      if (existing && existing.customMetadata?.sha256 !== sha256) throw new Error("Financial archive checksum mismatch");
      if (!existing) {
        const written = await env.FINANCE_BACKUPS.put(key, body, {
          onlyIf: { etagDoesNotMatch: "*" },
          httpMetadata: { contentType: "application/json" },
          customMetadata: { sha256, databaseId: env.DATABASE_ID, fromExclusive: String(cursor.lastEventId), toInclusive: String(lastId) },
        });
        if (!written) {
          const raced = await env.FINANCE_BACKUPS.head(key);
          if (raced?.customMetadata?.sha256 !== sha256) throw new Error("Financial archive write was not confirmed");
        }
      }
      // Advance only after R2 confirms durable storage. CAS handles overlapping
      // cron runs; a failed checkpoint safely replays the immutable chunk.
      await env.DB.prepare(`UPDATE finance_backup_state SET last_event_id = ?, last_chunk_key = ?, last_sha256 = ?, last_success_at = ?, last_checked_at = ?, last_error = NULL
        WHERE id = 1 AND last_event_id = ? AND last_sha256 IS ?`)
        .bind(lastId, key, sha256, now, now, cursor.lastEventId, cursor.lastSha256).run();
    }
  } catch {
    await env.DB.prepare("UPDATE finance_backup_state SET last_checked_at = ?, last_error = 'Cloud archive failed; pending events remain in D1 for retry' WHERE id = 1").bind(new Date().toISOString()).run();
    throw new Error("Financial archive failed; retry required");
  }
}
