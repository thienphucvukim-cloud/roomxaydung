import vinext from "vinext";
import { defineConfig } from "vite";
import { localBindings, localStatePath } from "./scripts/local-data.mjs";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { sites } from "./build/sites-vite-plugin";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const managedLinux = readExecutionProfile() === "managed-linux";
const deployToCloudflare = process.env.TIPOOK_DEPLOY_TARGET === "cloudflare";

const localBindingConfig = {
  main: "vinext/server/fetch-handler",
  // Explicit integration-test mode; never applied to Cloudflare builds.
  ...(process.env.TIPOOK_AUTH_EMAIL_TEST === "1" ? { vars: { AUTH_EMAIL_PROVIDER: "test" } } : {}),
  compatibility_flags: ["nodejs_compat"],
  ...localBindings,
};

export default defineConfig(async () => {
  // Use Miniflare's local Request.cf placeholder unless fetching is requested.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      ...(managedLinux ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] } : {}),
      watch: {
        ignored: ["**/.sites-runtime/**", "**/.wrangler/**", "**/.vinext/**", "**/.vscode/**"],
        ...(isCodexSeatbeltSandbox || process.platform === "win32" ? { useFsEvents: false, usePolling: true } : {}),
      },
    },
    plugins: [
      vinext(),
      sites({ mockAuth: !managedLinux && !deployToCloudflare, localPasswordAuth: true }),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        ...(!deployToCloudflare ? { persistState: { path: localStatePath } } : {}),
        ...(deployToCloudflare
          ? { configPath: "wrangler.jsonc" }
          : { config: (config) => {
            // Replace arrays instead of concatenating the production bindings
            // discovered from wrangler.jsonc (including nodejs_compat).
            Object.assign(config, localBindingConfig);
          } }),
      }),
    ],
  };
});
