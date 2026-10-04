/// <reference types="vite/client" />
declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ASSETS?: Fetcher;
    API_RUNTIME?: DurableObjectNamespace<import("./worker/api-runtime").ApiRuntime>;
  }
}
