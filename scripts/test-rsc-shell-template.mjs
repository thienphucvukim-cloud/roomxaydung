import assert from 'node:assert/strict';
import { replaceRscShellTemplate } from '../lib/rsc-shell-template.ts';
const marker = '__detail_id__';
const text = `Ảnh kiến trúc NhàĐẹpChất\n<link href="/bai-viet/${marker}">`;
const record = (id, value) => `${id}:T${Buffer.byteLength(value).toString(16)},${value}`;
const payload = `0:{"page":"/bai-viet/${marker}"}\n${record('a', text)}${record('b', 'Hồ sơ ' + marker)}1:null\n`;
for (const id of ['18', 'member_long_identifier_123456789']) {
  const replace = value => value.replaceAll(marker, id);
  assert.equal(replaceRscShellTemplate(payload, marker, id), `0:{"page":"/bai-viet/${id}"}\n${record('a', replace(text))}${record('b', replace('Hồ sơ ' + marker))}1:null\n`);
}
assert.equal(replaceRscShellTemplate('0:{"ok":true}\n', marker, '18'), '0:{"ok":true}\n');
assert.throws(() => replaceRscShellTemplate(`1:Tffff,${marker}`, marker, '18'));
console.log('PASS: detail ID substitution preserves UTF-8 byte counts for streamed RSC metadata, adjacent text chunks and newlines.');
