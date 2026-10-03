// Local database uploads are disabled at the user's request.
// Do not read databases, create snapshots, or invoke Cloudflare from this entry point.
console.error("Local cloud backup is disabled. No database has been read or uploaded.");
process.exitCode = 1;
