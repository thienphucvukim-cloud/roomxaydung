// Sites identity headers are trusted only behind the Sites authentication proxy.
// A standalone Cloudflare Worker receives requests directly from the public.
export function cloudflareRequest(request: Request) {
  const headers = new Headers(request.headers);
  for (const name of Array.from(headers.keys())) {
    if (name.startsWith("oai-authenticated-user-")) headers.delete(name);
  }
  return new Request(request, { headers });
}
