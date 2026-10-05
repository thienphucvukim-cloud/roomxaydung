import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Run against the local dev server. All member APIs are mocked; no real
// passwords or account statuses are changed by these interaction checks.
const origin = process.env.TIPOOK_TEST_ORIGIN || 'http://localhost:5173';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const dir = path.resolve('.sites-runtime/member-management-review');
mkdirSync(dir, { recursive: true });
const browserPath = process.env.TIPOOK_BROWSER_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'chromium');
const chrome = spawn(browserPath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9225', `--user-data-dir=${path.join(dir, 'chrome')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let startupError, socket;
chrome.on('error', error => { startupError = error; });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let tabs;
  for (let i = 0; i < 80; i++) { try { tabs = await (await fetch('http://127.0.0.1:9225/json/list')).json(); break; } catch { await pause(250); } }
  assert.ok(tabs?.length, startupError?.message || 'Headless Chrome must start');
  socket = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let seq = 0;
  const pending = new Map(), exceptions = [];
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.id) { const request = pending.get(data.id); pending.delete(data.id); if (data.error) request?.reject(new Error(JSON.stringify(data.error))); else request?.resolve(data.result); }
    if (data.method === 'Runtime.exceptionThrown') exceptions.push(data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, label) => { for (let i = 0; i < 150; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } console.log(await evaluate('document.body?.innerText.slice(0, 3000)'), exceptions); throw new Error('Timeout: ' + label); };
  const click = async expression => {
    const point = await evaluate(`(() => { const button = ${expression}; button.scrollIntoView({ block: 'center', inline: 'center' }); const rect = button.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
  };
  const rowButton = label => `Array.from(document.querySelector('.admin-table tbody tr:last-child').querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(label)})`;
  const panelButton = label => `Array.from(document.querySelector('.owner-record-detail').querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(label)})`;
  const setValue = async (name, value) => evaluate(`(() => { const field = document.querySelector('.owner-record-detail [name="${name}"]'); const setter = Object.getOwnPropertyDescriptor(field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set; setter.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const nativeFetch = window.fetch.bind(window);
    window.memberReview = { requests: [], history: [], failModeration: false, failPassword: false, listRequests: 0, members: Array.from({ length: 20 }, (_, i) => ({ userId: 'review-member-' + i, displayName: 'Thành viên thử nghiệm ' + i, email: 'member' + i + '@example.test', username: 'member' + i, canResetPassword: i !== 0, canModerate: i !== 0, accountStatus: 'active', moderationReason: '', moderationVersion: 0, accountType: 'user', profession: null, updatedAt: '2026-10-05T08:00:00.000Z', postCount: i })) };
    window.fetch = async (input, init = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
      const json = (value, status = 200) => Promise.resolve(new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }));
      const review = window.memberReview;
      if (url.pathname === '/api/me') return json({ user: { id: 'review-admin', name: 'Quản trị', isAdmin: true, authenticated: true } });
      if (url.pathname === '/api/admin/manage/members') { review.listRequests++; return json({ items: review.members, total: review.members.length }); }
      if (url.pathname === '/api/admin/member-moderation') {
        const body = JSON.parse(init.body); review.requests.push({ ...body, kind: 'moderation' });
        if (review.failModeration) return json({ error: 'Lỗi xử lý thử nghiệm. Hãy thử lại.' }, 503);
        const member = review.members.find(item => item.userId === body.userId);
        member.accountStatus = { disable: 'disabled', enable: 'active', delete: 'deleted' }[body.action]; member.moderationVersion++; member.moderationReason = body.reason; member.canResetPassword = member.accountStatus === 'active';
        return json({ success: true });
      }
      if (url.pathname === '/api/admin/member-password') {
        if (init.method !== 'POST') return json({ history: review.history });
        const body = JSON.parse(init.body); review.requests.push({ ...body, kind: 'password' });
        if (review.failPassword) return json({ error: 'Mật khẩu quản trị chưa đúng.' }, 403);
        review.history.push({ id: 'review-reset', performedBy: 'review-admin', verificationNote: body.verificationNote, createdAt: new Date().toISOString() });
        return json({ passwordReset: true });
      }
      return nativeFetch(input, init);
    };
  })();` });
  for (const width of [1440, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 1024 });
    await send('Page.navigate', { url: origin + '/?quan-ly=thanh-vien' });
    await waitFor(`document.querySelectorAll('.admin-table tbody tr').length === 20`, 'member list');
    assert.equal(await evaluate(`document.querySelector('.admin-table tbody tr').querySelector('button')`), null, 'Protected accounts expose no processing buttons');
    for (const label of ['Vô hiệu hóa', 'Xóa tài khoản', 'Đặt lại mật khẩu']) {
      await click(rowButton(label));
      await waitFor(`document.querySelector('.owner-record-detail h3')?.textContent.includes('member19')`, label + ' form');
      await pause(150);
      const visible = await evaluate(`(() => { const dialog = document.querySelector('.owner-management-dialog').getBoundingClientRect(), panel = document.querySelector('.owner-record-detail').getBoundingClientRect(); return { top: panel.top, dialogTop: dialog.top, dialogBottom: dialog.bottom, left: panel.left, right: panel.right, dialogLeft: dialog.left, dialogRight: dialog.right, focusedPanel: document.activeElement?.getAttribute('aria-label') }; })()`);
      assert.ok(visible.top >= visible.dialogTop && visible.top < visible.dialogBottom - 40, label + ' form must open visibly after clicking the last row: ' + JSON.stringify(visible));
      assert.ok(visible.left >= visible.dialogLeft && visible.right <= visible.dialogRight, 'Form must fit horizontally after scrolling to row actions');
      assert.equal(visible.focusedPanel, 'Xử lý tài khoản thành viên');
      // Clicking the same row/action again must also reveal an already-open form.
      await click(rowButton(label));
      await pause(150);
      assert.equal(await evaluate(`document.activeElement?.getAttribute('aria-label')`), 'Xử lý tài khoản thành viên');
      if (width === 390 && label === 'Vô hiệu hóa') writeFileSync(path.join(dir, 'mobile-member-action.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      await click(panelButton(label === 'Đặt lại mật khẩu' ? 'Đóng' : 'Hủy'));
      await waitFor(`!document.querySelector('.owner-record-detail')`, 'cancel');
      assert.deepEqual(await evaluate('window.memberReview.requests'), [], 'Opening/canceling must never send a mutation');
    }
  }
  await click(rowButton('Đặt lại mật khẩu'));
  await waitFor(`document.querySelector('[name="verificationNote"]')`, 'password form');
  await setValue('verificationNote', 'Đã xác minh qua thông tin liên hệ đã lưu.');
  await click(`document.querySelector('[name="verified"]')`);
  await setValue('newPassword', 'MemberTest123'); await setValue('confirmPassword', 'Different123'); await setValue('adminPassword', 'AdminTest123');
  await click(panelButton('Xác nhận đặt lại mật khẩu'));
  await waitFor(`document.querySelector('.owner-record-detail [role="alert"]')?.textContent.includes('chưa khớp')`, 'password mismatch');
  assert.equal(await evaluate('window.memberReview.requests.length'), 0);
  await setValue('confirmPassword', 'MemberTest123');
  await evaluate('window.memberReview.failPassword = true');
  await click(panelButton('Xác nhận đặt lại mật khẩu'));
  await waitFor(`document.querySelector('.owner-record-detail [role="alert"]')?.textContent.includes('chưa đúng')`, 'password server error');
  await evaluate('window.memberReview.failPassword = false');
  await click(panelButton('Xác nhận đặt lại mật khẩu'));
  await waitFor(`document.querySelector('.owner-record-detail [role="status"]')?.textContent.includes('Đã đặt lại mật khẩu')`, 'password success');
  assert.deepEqual(await evaluate('window.memberReview.requests.at(-1)'), { kind: 'password', userId: 'review-member-19', verified: true, verificationNote: 'Đã xác minh qua thông tin liên hệ đã lưu.', newPassword: 'MemberTest123', adminPassword: 'AdminTest123' });
  await waitFor(`document.querySelector('.owner-record-detail li')`, 'reset history refreshed');
  await click(panelButton('Đóng'));
  for (const [button, action, status, version] of [['Vô hiệu hóa', 'disable', 'disabled', 0], ['Mở lại', 'enable', 'active', 1], ['Xóa tài khoản', 'delete', 'deleted', 2]]) {
    await click(rowButton(button));
    await waitFor(`document.querySelector('[name="reason"]')`, 'moderation form');
    await setValue('reason', 'Đã kiểm tra báo cáo thử nghiệm.');
    await click(`document.querySelector('.owner-record-detail input[type="checkbox"]')`);
    const submit = `document.querySelector('.owner-record-detail form button:not([type="button"])')`;
    if (action === 'disable') {
      await evaluate('window.memberReview.failModeration = true');
      await click(submit);
      await waitFor(`document.querySelector('.owner-record-detail [role="alert"]')?.textContent.includes('Lỗi xử lý')`, 'moderation error');
      assert.equal(await evaluate('window.memberReview.members.at(-1).accountStatus'), 'active');
      await evaluate('window.memberReview.failModeration = false');
    }
    const requests = await evaluate('window.memberReview.listRequests');
    await click(submit);
    await waitFor(`!document.querySelector('.owner-record-detail') && window.memberReview.listRequests > ${requests} && !document.querySelector('.admin-loading')`, 'moderation refresh');
    assert.equal(await evaluate(`document.activeElement?.getAttribute('role')`), 'status', 'The completion message must receive focus');
    assert.ok(await evaluate(`(() => { const message = document.activeElement.getBoundingClientRect(), dialog = document.querySelector('.owner-management-dialog').getBoundingClientRect(); return message.top >= dialog.top && message.bottom <= dialog.bottom; })()`), 'The completion message must remain visible');
    assert.deepEqual(await evaluate('window.memberReview.requests.at(-1)'), { kind: 'moderation', userId: 'review-member-19', action, reason: 'Đã kiểm tra báo cáo thử nghiệm.', version });
    await waitFor(`document.querySelector('.admin-table tbody tr:last-child')?.textContent.includes(${JSON.stringify({ active: 'Đang hoạt động', disabled: 'Đã vô hiệu hóa', deleted: 'Đã xóa' }[status])})`, 'updated status');
  }
  assert.equal(await evaluate(`document.querySelector('.admin-table tbody tr:last-child').querySelectorAll('button').length`), 0, 'Deleted accounts cannot be reopened');
  assert.deepEqual(exceptions, []);
  console.log('PASS: member action forms appear and receive focus at 320/390/1440px from the last row; cancel sends no changes; reset password validation/errors/history; disable/reopen/delete target the correct member, refresh status and handle retries; protected/deleted accounts stay protected.');
} finally { socket?.close(); chrome.kill(); }
