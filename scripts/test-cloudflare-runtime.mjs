import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const webpFixture = readFileSync(new URL('./fixtures/upload.webp', import.meta.url));
const origin = 'http://127.0.0.1:8788';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Use isolated local resources for authentication/upload fixtures');
const get = async path => fetch(origin + path, { redirect: 'manual' });
for (const path of ['/', '/dang-nhap', '/dang-ky', '/api/news-feed']) {
  const response = await get(path);
  assert.equal(response.status, 200, path + ': ' + await response.clone().text());
  await response.arrayBuffer();
}
const username = 'cpu_' + crypto.randomUUID().slice(0, 8);
let response = await fetch(origin + '/api/auth/register', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username, password: 'cpu-test-123456', name: 'CPU Test' }),
});
assert.equal(response.status, 200, await response.clone().text());
const cookie = response.headers.getSetCookie().find(value => value.startsWith('tipook_auth_session=')).split(';')[0];
response = await fetch(origin + '/api/me', { headers: { cookie } });
assert.equal(response.status, 200);
const profile = await response.json();
assert.equal(profile.user.authenticated, true);
assert.equal(profile.user.name, 'CPU Test');
response = await fetch(origin + '/api/public-profile/' + profile.user.id);
assert.equal(response.status, 200);
const publicProfile = await response.json();
assert.equal(publicProfile.displayName, 'CPU Test');
assert.equal(publicProfile.own, false);
assert.equal(publicProfile.email, undefined, 'Public profile must not expose contact/account fields');
response = await fetch(origin + '/api/public-profile/' + profile.user.id, { headers: { cookie } });
assert.equal((await response.json()).own, true);
assert.equal((await fetch(origin + '/api/public-profile/nonexistent-fixture')).status, 404);
const other = await fetch(origin + '/api/auth/register', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'cpu_' + crypto.randomUUID().slice(0, 8), password: 'cpu-test-123456', name: 'Other Session' }),
});
assert.equal(other.status, 200);
const otherCookie = other.headers.getSetCookie().find(value => value.startsWith('tipook_auth_session=')).split(';')[0];
await Promise.all(Array.from({ length: 12 }, async (_, i) => {
  const r = await fetch(origin + '/api/me', { headers: { cookie: i % 2 ? otherCookie : cookie } });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).user.name, i % 2 ? 'Other Session' : 'CPU Test', 'Concurrent API requests must keep their own identity');
}));
response = await fetch(origin + '/api/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username, password: 'cpu-test-123456' }),
});
assert.equal(response.status, 200, await response.clone().text());
assert.ok(response.headers.getSetCookie().some(value => value.startsWith('tipook_auth_session=')));
assert.equal((await fetch(origin + '/api/admin/settings', { headers: { cookie } })).status, 403);
assert.equal((await fetch(origin + '/api/me', { method: 'HEAD', headers: { cookie } })).body, null);
assert.equal((await fetch(origin + '/api/me', { method: 'OPTIONS' })).status, 204);
assert.equal((await fetch(origin + '/api/me', { method: 'DELETE' })).status, 405);
for (const purpose of ['drawing-preview', 'drawing-file']) {
  const form = new FormData();
  form.set('purpose', purpose);
  form.set('file', new File([purpose === 'drawing-file' ? 'fixture' : webpFixture], purpose === 'drawing-file' ? 'private.pdf' : 'public.webp', { type: purpose === 'drawing-file' ? 'application/pdf' : 'image/webp' }));
  response = await fetch(origin + '/api/files', { method: 'POST', headers: { cookie }, body: form });
  assert.equal(response.status, 201, await response.clone().text());
  const { attachment } = await response.json();
  const url = origin + '/api/files?key=' + attachment.key;
  for (const method of ['GET', 'HEAD']) {
    response = await fetch(url, { method });
    assert.equal(response.status, purpose === 'drawing-file' ? 403 : 200);
    if (purpose === 'drawing-preview' && method === 'GET') assert.deepEqual(Buffer.from(await response.arrayBuffer()), webpFixture);
    if (method === 'HEAD') assert.equal(await response.text(), '');
  }
  response = await fetch(origin + '/_next/image?url=' + encodeURIComponent('/api/files?key=' + attachment.key) + '&w=640&q=75');
  assert.equal(response.status, purpose === 'drawing-file' ? 404 : 200);
  if (purpose === 'drawing-preview') assert.equal(response.headers.get('content-type'), 'image/webp');
  response = await fetch(url, { method: 'DELETE', headers: { cookie } });
  assert.equal(response.status, 200, await response.clone().text());
}
response = await fetch(origin + '/api/files', { method: 'POST' });
assert.equal(response.status, 401);
response = await fetch(origin + '/api/me', { headers: { cookie: 'tipook_auth_session=invalid', 'oai-authenticated-user-id': 'fake-admin' } });
assert.equal(response.status, 200);
assert.equal((await response.json()).user, null);
console.log('PASS: production build serves pages, registration, authenticated profile, public upload/read/HEAD/delete and private-file denial with isolated local data.');
