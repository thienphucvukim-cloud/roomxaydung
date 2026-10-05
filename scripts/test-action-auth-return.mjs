import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { safeAuthReturn } from '../lib/auth-return.ts';
const source = ts.transpileModule(readFileSync(new URL('../lib/action-auth-return.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText.replace('"./auth-return"', JSON.stringify(new URL('../lib/auth-return.ts', import.meta.url).href));
const { actionAuthReturn, authActionTarget, modelAuthAnchor } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
assert.equal(actionAuthReturn('https://nhadepchat.top/', '42'), '/bai-viet/42');
assert.equal(actionAuthReturn('/bai-viet/42', '42'), '/bai-viet/42');
for(const base of ['/kho-mau-nha-dep-chat','/file-ban-ve-nha-dep-chat','/noi-that']){
  const result=actionAuthReturn(base+'?q=house&sort=views&page=4#old','42');
  assert.equal(result,'/bai-viet/42');
  assert.equal(actionAuthReturn(base,'42',null,'/nha-pho-2-tang'),'/nha-pho-2-tang');
  assert.equal(actionAuthReturn(base,'42',null,'//foreign.example'),'/bai-viet/42');
  assert.equal(actionAuthReturn(base+'/page/4','42'),'/bai-viet/42');
}
assert.equal(actionAuthReturn('/kho-mau-nha-dep-chat?sort=views&postId=1&page=2',null,'Nhà phố'),'/kho-mau-nha-dep-chat?sort=views&q=Nh%C3%A0+ph%E1%BB%91#model-Nh%C3%A0%20ph%E1%BB%91');
assert.equal(actionAuthReturn('/tai-khoan?section=saved#items'),'/tai-khoan?section=saved#items');
assert.equal(actionAuthReturn('/api/auth/login'),'/');
assert.equal(actionAuthReturn('/?q=abc','9007199254740992'),'/?q=abc');
assert.equal(safeAuthReturn('/file-ban-ve-nha-dep-chat?postId=42#post-42'),'/file-ban-ve-nha-dep-chat?postId=42#post-42');
assert.equal(safeAuthReturn('//external.test'),'/tai-khoan');
console.log('PASS: exact post return links, preserved catalog filters, page reset, model targets, query/hash and redirect safety.');

assert.deepEqual(authActionTarget('post','42'),{'data-auth-post-id':'42','data-auth-model-query':undefined});
assert.deepEqual(authActionTarget('drawing','Nhà phố'),{'data-auth-post-id':undefined,'data-auth-model-query':'Nhà phố'});
assert.equal(new URL(actionAuthReturn('/file-ban-ve-nha-dep-chat/page/3?sort=downloads',null,'Nhà phố'), 'https://tipook.local').hash,'#'+modelAuthAnchor('Nhà phố'));
