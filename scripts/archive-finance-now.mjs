// Uses the same archiver as the scheduled Worker for pre-maintenance backups.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { archiveFinance } from "../lib/finance-archive.ts";
import { archiveBucket, productionDatabase, productionQuery, root, wrangler } from "./cloudflare-data.mjs";

const sha256 = body => createHash("sha256").update(body).digest("hex");
const literal = value => {
  if (value === null) return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return "'" + value.replaceAll("'", "''") + "'";
  throw new Error("Unsupported SQL parameter");
};
const directory = path.join(root, ".sites-runtime/finance-archive-manual");
mkdirSync(directory, { recursive: true });
const DB = {
  prepare(sql) {
    let params = [];
    const statement = {
      bind(...values) { params = values; return statement; },
      sql() { let index = 0; const expanded = sql.replaceAll("?", () => literal(params[index++])); if (index !== params.length) throw new Error("SQL parameter count mismatch"); return expanded; },
      async run() { productionQuery(statement.sql()); return { success: true }; },
    };
    return statement;
  },
  async batch(statements) { return productionQuery(statements.map(statement => statement.sql()).join("; ")).map(results => ({ results })); },
};
const FINANCE_BACKUPS = {
  async head(key) {
    try {
      const body = wrangler(["r2", "object", "get", `${archiveBucket}/${key}`, "--remote", "--pipe", "--config", "wrangler.finance-backup.jsonc"], { capture: true });
      return { customMetadata: { sha256: sha256(body) } };
    } catch (error) {
      if (/not found|does not exist|404/i.test(error.message)) return null;
      throw error;
    }
  },
  async put(key, body) {
    const file = path.join(directory, sha256(body) + ".json"); writeFileSync(file, body);
    try {
      wrangler(["r2", "object", "put", `${archiveBucket}/${key}`, "--file", file, "--remote", "--config", "wrangler.finance-backup.jsonc", "--content-type", "application/json"], { capture: true });
      return { key };
    } catch (error) {
      // Another cron run may have already written and locked this same chunk.
      const existing = await FINANCE_BACKUPS.head(key);
      if (existing?.customMetadata.sha256 === sha256(body)) return { key };
      throw error;
    }
  },
};
await archiveFinance({ DB, FINANCE_BACKUPS, DATABASE_ID: productionDatabase.database_id });
const [status] = productionQuery("SELECT last_event_id, last_success_at, last_checked_at, last_error, (SELECT max(id) FROM finance_audit_events) AS newest_event_id FROM finance_backup_state WHERE id = 1")[0];
console.log(JSON.stringify(status));
