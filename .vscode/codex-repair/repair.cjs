// Local repair for the VS Code extension build observed in Codex.log.
// Never edits chats, queues, credentials, or Codex databases.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const extensionVersion = '26.928.31416';
const extensionRoot = path.join(process.env.USERPROFILE, '.vscode', 'extensions', `openai.chatgpt-${extensionVersion}-win32-x64`);
const target = path.join(extensionRoot, 'out', 'extension.js');
const originalFile = path.join(__dirname, 'extension.original.js');
const stagedFile = path.join(__dirname, 'extension.patched.js');
const manifestFile = path.join(__dirname, 'manifest.json');
const before = 'bodyJsonString:JSON.stringify(o)}}throw new Error("HTTP requests must use the HTTP fetch service.")';
const after = 'bodyJsonString:JSON.stringify(o)??"null"}}throw new Error("HTTP requests must use the HTTP fetch service.")';
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const count = (text, needle) => text.split(needle).length - 1;

function checkSyntax(file) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
}

async function testRegression(original, patched) {
  // Exercise the installed release handler, not a separately rewritten implementation.
  const match = original.match(/"queued-follow-up-send-lock-release":(async\(\{conversationId:e,messageId:r,lockId:n,sent:o\}\)=>\{this\.queuedFollowUpSendLocks\.release\(\{conversationId:e,messageId:r,lockId:n,sent:o\}\)\})/);
  assert.ok(match, 'Installed release handler differs; manual inspection required.');
  const calls = [];
  const host = { queuedFollowUpSendLocks: { release: params => calls.push(params) } };
  const releaseHandler = vm.runInNewContext(`(${match[1]})`, host);
  const payload = { conversationId: 'test-thread', messageId: 'test-message', lockId: 'test-lock', sent: true };
  const result = await releaseHandler.call(host, payload);
  assert.equal(result, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), payload);

  const oldExpression = original.match(/bodyJsonString:(JSON\.stringify\(o\))\}\}throw new Error/)[1];
  const newExpression = patched.match(/bodyJsonString:(JSON\.stringify\(o\)\?\?"null")\}\}throw new Error/)[1];
  const serializeOld = vm.runInNewContext(`o=>${oldExpression}`);
  const serializeNew = vm.runInNewContext(`o=>${newExpression}`);
  assert.throws(() => JSON.parse(serializeOld(result)), SyntaxError);
  assert.equal(JSON.parse(serializeNew(result)), null);
  for (const value of [null, false, true, 0, '', { acquired: false }, { acquired: true }, [], { success: true }]) {
    assert.equal(serializeNew(value), serializeOld(value), 'Existing JSON responses must be preserved.');
  }
  // Serialization must continue to reject malformed/unserializable results.
  const cycle = {}; cycle.self = cycle;
  assert.throws(() => serializeNew(cycle));
  assert.throws(() => serializeNew(1n));
  console.log('PASS: reproduced original failure; patched empty response parses; release arguments and existing responses preserved; serialization errors still rejected.');
}

async function main() {
  const mode = process.argv[2] || '--prepare';
  assert.ok(['--prepare', '--apply', '--verify', '--restore'].includes(mode), 'Unknown mode.');
  const metadata = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'package.json'), 'utf8'));
  assert.equal(metadata.version, extensionVersion, 'Extension version changed; inspect the new build before patching.');
  const installed = fs.readFileSync(target);
  if (mode === '--prepare') {
    const original = installed.toString('utf8');
    assert.equal(count(original, before), 1, 'Expected exactly one unpatched bridge.');
    assert.equal(count(original, after), 0);
    const patched = original.replace(before, after);
    if (fs.existsSync(originalFile)) assert.equal(hash(fs.readFileSync(originalFile)), hash(installed), 'Existing backup differs; refuse to overwrite.');
    else fs.writeFileSync(originalFile, installed, { flag: 'wx' });
    fs.writeFileSync(stagedFile, patched, 'utf8');
    checkSyntax(stagedFile);
    await testRegression(original, patched);
    const manifest = { version: extensionVersion, target, originalSha256: hash(installed), patchedSha256: hash(Buffer.from(patched)), createdAt: new Date().toISOString() };
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log('Prepared repair with original backup:', originalFile);
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  assert.equal(manifest.target, target);
  const backup = fs.readFileSync(originalFile);
  const staged = fs.readFileSync(stagedFile);
  assert.equal(hash(backup), manifest.originalSha256, 'Backup checksum mismatch.');
  assert.equal(hash(staged), manifest.patchedSha256, 'Staged checksum mismatch.');
  await testRegression(backup.toString('utf8'), staged.toString('utf8'));
  if (mode === '--apply') {
    assert.equal(hash(installed), manifest.originalSha256, 'Installed source changed; refuse to overwrite.');
    checkSyntax(stagedFile);
    fs.writeFileSync(target, staged);
    assert.equal(hash(fs.readFileSync(target)), manifest.patchedSha256);
    console.log('Applied repair. Reload the VS Code window after this chat finishes.');
  } else if (mode === '--restore') {
    assert.equal(hash(installed), manifest.patchedSha256, 'Installed source changed; refuse to restore over it.');
    fs.writeFileSync(target, backup);
    assert.equal(hash(fs.readFileSync(target)), manifest.originalSha256);
    console.log('Restored original. Reload the VS Code window.');
  } else {
    assert.equal(hash(installed), manifest.patchedSha256, 'Installed extension is not patched.');
    checkSyntax(target);
    console.log('PASS: installed repair checksum and JavaScript syntax verified.');
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
