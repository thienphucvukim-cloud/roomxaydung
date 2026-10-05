import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { inspectWebp, isImageUpload, validateOptimizedImage } from '../lib/image-upload-policy.ts';
import { catalogImageCategory, POST_CATEGORIES } from '../lib/legacy-contracts.ts';
for (const [prefix, category] of [['facade', POST_CATEGORIES.houseModels], ['drawing', POST_CATEGORIES.drawings], ['interior', POST_CATEGORIES.interiors]]) {
  assert.equal(catalogImageCategory(`${prefix}.0.image`), category);
  assert.equal(catalogImageCategory(`${prefix}.12.photo.3`), category);
  assert.equal(catalogImageCategory(`${prefix}.text.0`), undefined);
}
assert.equal(catalogImageCategory('global.logo'), undefined);
assert.equal(catalogImageCategory('about.image'), undefined);
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('miniflare'))('sharp');
const fixture = readFileSync(new URL('./fixtures/upload.webp', import.meta.url));
const image = (bytes = fixture, type = 'image/webp', name = 'photo.webp') => new File([bytes], name, { type });
assert.equal(await validateOptimizedImage(image()), null);
assert.ok(inspectWebp(fixture).width <= 320);
for (const options of [{ lossless: true }, { quality: 70 }]) {
  const transparent = await sharp({ create: { width: 32, height: 20, channels: 4, background: { r: 10, g: 80, b: 90, alpha: .4 } } }).webp(options).toBuffer();
  assert.deepEqual(inspectWebp(transparent), { width: 32, height: 20 });
  assert.equal(await validateOptimizedImage(image(transparent)), null);
}
for (const type of ['image/png', 'image/jpeg', 'image/gif', 'application/octet-stream']) {
  assert.equal((await validateOptimizedImage(image(fixture, type))).status, 415);
}
assert.equal((await validateOptimizedImage(image(Buffer.from('fake'), 'image/webp'))).status, 400);
assert.equal((await validateOptimizedImage(image(fixture.subarray(0, fixture.length - 1)))).status, 400);
assert.equal((await validateOptimizedImage(image(Buffer.concat([fixture, Buffer.from([0])])))).status, 400);
assert.equal((await validateOptimizedImage(image(new Uint8Array(512 * 1024 + 1)))).status, 413);
assert.equal((await validateOptimizedImage(image(new Uint8Array(256 * 1024 + 1)), 'comment')).status, 413);
const large = await sharp({ create: { width: 1601, height: 10, channels: 3, background: '#abcdef' } }).webp().toBuffer();
assert.equal((await validateOptimizedImage(image(large))).status, 413);
const commentLarge = await sharp({ create: { width: 1281, height: 10, channels: 3, background: '#abcdef' } }).webp().toBuffer();
assert.equal(await validateOptimizedImage(image(commentLarge)), null);
assert.equal((await validateOptimizedImage(image(commentLarge), 'comment')).status, 413);
const animated = Buffer.from(fixture);
// Reject explicit animation containers, even when callers spoof the MIME type.
animated.write('ANIM', 12);
assert.equal(inspectWebp(animated), null);
assert.equal(await isImageUpload(image(fixture, 'application/octet-stream', 'hidden.bin')), true);
assert.equal(await isImageUpload(new File([readFileSync('public/community-house.png')], 'hidden.bin', { type: 'application/octet-stream' })), true);
assert.equal(await isImageUpload(new File(['%PDF-1.4'], 'drawing.pdf', { type: 'application/pdf' })), false);
console.log('PASS: real lossy/lossless/transparent WebP, byte/dimension limits, fake/truncated/animated files, MIME and extension bypasses, unchanged documents.');
