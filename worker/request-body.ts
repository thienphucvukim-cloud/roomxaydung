// Durable Object fetch stubs can still be copying the caller's POST stream
// when an early auth/CSRF denial finishes. Drain without retaining bytes so
// no asynchronous reader outlives the caller's response.
export async function discardUnreadBody(request: Request) {
  if (!request.body || request.bodyUsed || request.body.locked) return;
  const reader = request.body.getReader();
  try { while (!(await reader.read()).done) { /* Discard each chunk. */ } }
  finally { reader.releaseLock(); }
}
