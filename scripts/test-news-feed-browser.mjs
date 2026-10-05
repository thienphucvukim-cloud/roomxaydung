import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Local browser regression checks use mocked APIs and do not publish test posts.
// Run with node scripts/test-news-feed-browser.mjs after starting the local server.
const origin = process.env.TIPOOK_TEST_ORIGIN || 'http://localhost:5173';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const root = process.cwd();
const dir = path.join(root, '.sites-runtime/news-review');
mkdirSync(dir, { recursive: true });
const browserPath = process.env.TIPOOK_BROWSER_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'chromium');
const chrome = spawn(browserPath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-software-rasterizer', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9224', `--user-data-dir=${path.join(dir, 'chrome')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let startupError;
chrome.on('error', error => { startupError = error; });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let tabs;
  for (let i = 0; i < 80; i++) { try { tabs = await (await fetch('http://127.0.0.1:9224/json/list')).json(); break; } catch { await pause(250); } }
  assert.ok(tabs?.length, startupError?.message || 'Headless Chrome must start (set TIPOOK_BROWSER_PATH if needed)');
  socket = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let seq = 0;
  const pending = new Map();
  const exceptions = [];
  socket.addEventListener('message', event => {
    const payload = JSON.parse(event.data);
    if (payload.id) { const request = pending.get(payload.id); pending.delete(payload.id); if (payload.error) request?.reject(new Error(JSON.stringify(payload.error))); else request?.resolve(payload.result); }
    if (payload.method === 'Runtime.exceptionThrown') exceptions.push(payload.params.exceptionDetails.text + ': ' + payload.params.exceptionDetails.exception?.description);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, label) => { for (let i = 0; i < 150; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } console.log(await evaluate(`JSON.stringify({ url:location.href, body:document.body?.innerText.slice(0,3500), review:!!window.review })`), exceptions); writeFileSync(path.join(dir, 'failure.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); throw new Error('Timeout: ' + label); };
  await send('Runtime.enable'); await send('Page.enable');
  // Public detail pages now return a real 404 for missing posts. Keep the
  // client API mocks, but use an existing public ID for server-side routing.
  const publicPosts = (await (await fetch(origin + '/api/news-feed')).json()).posts;
  assert.ok(publicPosts.length, 'Local review database needs a public post');
  const fixtureId = publicPosts[0].id;
  const fixture = {
    id: fixtureId, userId: 'review-author', authorName: 'Thành viên Tipook', avatarUrl: null, category: 'Bản vẽ cộng đồng',
    title: 'Nhà phố 5 × 20m', content: 'Giá bán: 150000đ\nChi phí 125000000 VND\nLiên hệ 0912345678', specifications: '5 × 20m', listingType: null, priceLabel: '150000', comments: 1,
    createdAt: '2026-10-03T08:00:00.000Z', sourceHref: `/file-ban-ve-nha-dep-chat?postId=${fixtureId}#post-${fixtureId}`, sourceLabel: 'Kho bản vẽ',
    images: Array.from({ length: 7 }, (_, index) => ({ url: index % 2 ? '/mat-bang-5x20.png' : '/community-house.png', name: `Ảnh ${index + 1}` })),
  };
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const nativeFetch = window.fetch.bind(window);
    const post = ${JSON.stringify(fixture)};
    window.reviewErrors = [];
    window.addEventListener('error', event => { if (event.message) window.reviewErrors.push(event.message); });
    window.review = { comments: [{ id: 1, userId: 'review-reader', authorName: 'Người đọc', content: 'Bình luận có ảnh', imageUrl: '/community-house.png', createdAt: '2026-10-03T08:01:00.000Z' }], liked: false, uploads: [], failSend: false, failMore: true };
    window.review.feedRequests = [];
    window.fetch = async (input, init = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
      const method = init.method || 'GET';
      const json = (value, status = 200) => Promise.resolve(new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }));
      if (url.pathname === '/api/me') return json({ user: { id: 'review-user', name: 'Người kiểm tra', authenticated: true, avatarUrl: null, isAdmin: new URLSearchParams(location.search).has('review-admin') } });
      if (url.pathname === '/api/news-feed') {
        const category = window.review.sourceCategory || post.category;
        const sourcePath = category === 'Bộ sưu tập ảnh' ? '/kho-mau-nha-dep-chat' : category === 'Nội thất cộng đồng' ? '/noi-that' : '/file-ban-ve-nha-dep-chat';
        const original = { ...post, category, sourceHref: sourcePath + '?postId=' + post.id + '#post-' + post.id, comments: window.review.comments.length };
        const second = { ...post, id: 900002, title: 'Bài viết tiếp theo', content: 'Nội dung bài đăng tiếp theo', category: 'Bảng tin', sourceLabel: 'Bảng tin', sourceHref: '/bai-viet/900002', images: [], comments: 0, createdAt: '2026-10-02T08:00:00.000Z' };
        const items = [original, second].filter(item => (!url.searchParams.get('category') || item.category === url.searchParams.get('category')) && (!url.searchParams.get('postId') || item.id === Number(url.searchParams.get('postId'))) && (!url.searchParams.get('q') || (item.title + item.content).includes(url.searchParams.get('q'))));
        const page = Number(url.searchParams.get('page') || 1);
        window.review.feedRequests.push(page);
        if (page === 2 && window.review.failMore) { window.review.failMore = false; return json({ error: 'Lỗi tải thêm thử nghiệm.' }, 503); }
        return json({ posts: items.slice(page - 1, page), total: items.length, page, totalPages: Math.max(1, items.length) });
      }
      if (url.pathname === '/api/posts' && url.searchParams.get('postId')) {
        const target = { ...post, category: url.searchParams.get('category'), attachments: post.images.map((image, index) => ({ key: 'review-' + index, name: image.name, type: 'image/png', size: 100, url: image.url })) };
        return json({ posts: url.searchParams.get('postId') === String(post.id) ? [target] : [], total: 1, nextCursor: null });
      }
      if (url.pathname === '/api/actions') { if (method !== 'GET') window.review.liked = method === 'POST'; return json({ actions: window.review.liked ? [{}] : [], count: window.review.liked ? 1 : 0 }); }
      if (url.pathname === '/api/files' && method === 'POST') { const file = init.body.get('file'); window.review.uploads.push({ name: file.name, size: file.size, type: file.type }); return json({ attachment: { key: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', url: '/community-house.png', name: file.name } }, 201); }
      if (url.pathname === '/api/comments') {
        if (method === 'GET') return json({ comments: window.review.comments, total: window.review.comments.length, nextCursor: null });
        const body = JSON.parse(init.body);
        if (window.review.failSend) return json({ error: 'Lỗi thử nghiệm, hãy thử lại.' }, 503);
        const comment = { id: window.review.comments.length + 1, userId: 'review-user', authorName: 'Người kiểm tra', content: body.content, imageUrl: body.imageKey ? '/community-house.png' : null, createdAt: new Date().toISOString() };
        window.review.comments.push(comment); window.review.lastBody = body; return json({ comment, total: window.review.comments.length }, 201);
      }
      return nativeFetch(input, init);
    };
  })();` });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: origin });
  await waitFor(`document.querySelector('button[aria-label="Xem ảnh 1 của bài viết Nhà phố 5 × 20m"]')`, 'feed hydration');
  const browserModule = file => ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^import .*;\s*$/gm, '').replace(/^export /gm, '');
  await evaluate(`(() => { ${browserModule('lib/legacy-contracts.ts')} ${browserModule('lib/image-upload-policy.ts')} ${browserModule('lib/image-watermark.ts')} ${browserModule('lib/image-upload.ts')} window.optimizeUploadFixture=optimizeImageForUpload; window.optimizePostUploadFixture=optimizePostImageForUpload; window.inspectWebpFixture=inspectWebp; })()`);
  const compression = await evaluate(`(async () => {
    const canvas=document.createElement('canvas'); canvas.width=2200; canvas.height=1600;
    const ctx=canvas.getContext('2d'), pixels=ctx.createImageData(canvas.width,canvas.height);
    let seed=42; for(let i=0;i<pixels.data.length;i+=4){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;pixels.data[i]=seed&255;pixels.data[i+1]=(seed>>>8)&255;pixels.data[i+2]=(seed>>>16)&255;pixels.data[i+3]=255;} ctx.putImageData(pixels,0,0);
    const source=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    const results=[]; for(const kind of ['post','comment','avatar']) {
      const result=await window.optimizeUploadFixture(new File([source],'large.png',{type:'image/png'}),kind);
      results.push({kind,type:result.type,name:result.name,size:result.size,sourceSize:source.size,...window.inspectWebpFixture(new Uint8Array(await result.arrayBuffer()))});
    }
    canvas.width=32;canvas.height=20;ctx.clearRect(0,0,32,20);ctx.fillStyle='rgba(10,80,90,.4)';ctx.fillRect(0,0,32,20);
    const transparent=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    const alphaFile=await window.optimizeUploadFixture(new File([transparent],'alpha.png',{type:'image/png'}));
    const bitmap=await createImageBitmap(alphaFile);ctx.clearRect(0,0,32,20);ctx.drawImage(bitmap,0,0);const alpha=ctx.getImageData(0,0,1,1).data[3];bitmap.close();
    const gif=Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),c=>c.charCodeAt(0));
    const gifFile=await window.optimizeUploadFixture(new File([gif],'tiny.gif',{type:'image/gif'}),'comment');
    let corruptRejected=false;try{await window.optimizeUploadFixture(new File(['broken'],'bad.jpg',{type:'image/jpeg'}));}catch{corruptRejected=true;}
    const pdf=new File(['%PDF-1.4'],'drawing.pdf',{type:'application/pdf'});const untouched=await window.optimizeUploadFixture(pdf)===pdf;
    const original=HTMLCanvasElement.prototype.toBlob; let unsupportedRejected=false;
    try{HTMLCanvasElement.prototype.toBlob=function(callback){callback(new Blob(['fallback'],{type:'image/png'}));};await window.optimizeUploadFixture(new File([source],'fallback.png',{type:'image/png'}));}catch{unsupportedRejected=true;}finally{HTMLCanvasElement.prototype.toBlob=original;}
    canvas.width=0;canvas.height=0;
    return {results,alpha,gifType:gifFile.type,corruptRejected,untouched,unsupportedRejected};
  })()`);
  for (const item of compression.results) {
    const limits = {post:[1600,512*1024],comment:[1280,256*1024],avatar:[512,96*1024]}[item.kind];
    assert.equal(item.type,'image/webp'); assert.ok(item.name.endsWith('.webp'));
    assert.ok(Math.max(item.width,item.height)<=limits[0]); assert.ok(item.size<=limits[1]); assert.ok(item.size<item.sourceSize);
  }
  assert.ok(compression.alpha>0 && compression.alpha<255,'Preserve transparency');
  assert.equal(compression.gifType,'image/webp');assert.equal(compression.corruptRejected,true);assert.equal(compression.untouched,true);assert.equal(compression.unsupportedRejected,true);
  console.log('PASS: browser compresses large noisy PNG to bounded WebP for posts/comments/avatars; transparency, GIF, invalid images and unsupported encoder handled.');
  const watermark = await evaluate(`(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 800;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#102f49'; ctx.fillRect(0, 0, 1200, 800);
    const source = new File([await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))], 'watermark.png', { type: 'image/png' });
    const decode = HTMLImageElement.prototype.decode;
    let logoFailureRejected = false;
    try {
      HTMLImageElement.prototype.decode = function () { return this.src.endsWith('/nhadepchat-logo.png') ? Promise.reject(new Error('fixture')) : decode.call(this); };
      await window.optimizePostUploadFixture(source, 'Bộ sưu tập ảnh');
    } catch { logoFailureRejected = true; } finally { HTMLImageElement.prototype.decode = decode; }
    const inspectPixels = async file => {
      const bitmap = await createImageBitmap(file);
      canvas.width = bitmap.width; canvas.height = bitmap.height; ctx.drawImage(bitmap, 0, 0); bitmap.close();
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let changed = 0, left = canvas.width, right = 0, top = canvas.height, bottom = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const offset = (y * canvas.width + x) * 4;
        if (Math.abs(data[offset] - 16) + Math.abs(data[offset + 1] - 47) + Math.abs(data[offset + 2] - 73) > 35) {
          changed++; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      return { width: canvas.width, height: canvas.height, changed, left, right, top, bottom, size: file.size, type: file.type };
    };
    const results = [];
    for (const category of ['Bộ sưu tập ảnh', 'Bản vẽ cộng đồng', 'Nội thất cộng đồng', 'Bảng tin']) {
      results.push({ category, ...await inspectPixels(await window.optimizePostUploadFixture(source, category)) });
    }
    for (const kind of ['comment', 'avatar']) {
      results.push({ category: kind, ...await inspectPixels(await window.optimizeUploadFixture(source, kind, { watermark: true })) });
    }
    const encode = HTMLCanvasElement.prototype.toBlob;
    let attempts = 0, reduced;
    try {
      HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
        if (type === 'image/webp' && ++attempts <= 3) callback(new Blob([new Uint8Array(512 * 1024 + 1)], { type }));
        else encode.call(this, callback, type, quality);
      };
      reduced = await inspectPixels(await window.optimizePostUploadFixture(source, 'Bộ sưu tập ảnh'));
    } finally { HTMLCanvasElement.prototype.toBlob = encode; }
    const samples = [];
    for (const [url, name] of [['/community-house.png', 'watermark-house.webp'], ['/mat-bang-5x20.png', 'watermark-drawing.webp']]) {
      const image = new File([await (await fetch(url)).blob()], name, { type: 'image/png' });
      const file = await window.optimizePostUploadFixture(image, 'Bộ sưu tập ảnh');
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
      samples.push({ name, base64: btoa(binary) });
    }
    return { results, reduced, attempts, logoFailureRejected, samples };
  })()`);
  assert.equal(watermark.logoFailureRejected, true, 'A missing logo must not silently upload an unmarked catalog photo');
  for (const result of [...watermark.results.slice(0, 3), watermark.reduced]) {
    assert.ok(result.changed > 50, 'Logo must be burned into the encoded pixels');
    assert.ok(result.top > result.height * 0.8 && result.bottom < result.height, 'Logo must stay near the bottom');
    assert.ok(result.right - result.left < result.width * 0.26, 'Logo must remain modest in size');
    assert.ok(Math.abs((result.left + result.right) / 2 - result.width / 2) < 10, 'Logo must be horizontally centered');
    assert.equal(result.type, 'image/webp'); assert.ok(result.size <= 512 * 1024);
  }
  assert.equal(watermark.reduced.width, 960, 'Logo must survive size reduction after compression retries');
  assert.ok(watermark.results.slice(3).every(result => result.changed === 0), 'News photos, comments and avatars must remain unmarked');
  for (const sample of watermark.samples) writeFileSync(path.join(dir, sample.name), Buffer.from(sample.base64, 'base64'));
  console.log('PASS: all three catalog categories embed a small bottom-centered logo in WebP; compression retries retain it; logo load failures retry safely; unrelated images stay unmarked.');
  assert.equal(await evaluate(`Math.round(document.querySelector('main').getBoundingClientRect().width)`), 1320);
  assert.ok(await evaluate(`document.querySelector('article').innerText.includes('150.000đ') && document.querySelector('article').innerText.includes('125.000.000 VND')`));
  assert.equal(await evaluate(`document.querySelector('article time').closest('a')`), null);
  await waitFor(`document.querySelector('[role="alert"]')?.textContent.includes('Lỗi tải thêm thử nghiệm.')`, 'load-more failure');
  assert.equal(await evaluate(`document.querySelectorAll('article').length`), 1);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Thử tải thêm bài đăng').click()`);
  await waitFor(`document.querySelectorAll('article').length === 2`, 'infinite scroll retry preserves the first page and appends the second');
  assert.deepEqual(await evaluate('window.review.feedRequests'), [1, 2, 2], 'Loading/retrying page two must not reload page one');
  await evaluate(`window.dispatchEvent(new Event('focus'))`);
  await pause(250);
  assert.deepEqual(await evaluate('window.review.feedRequests'), [1, 2, 2], 'Returning to a scrolled feed must not refetch every loaded page');
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Làm mới')).click()`);
  await waitFor(`window.review.feedRequests.length === 5 && !Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Làm mới')).disabled`, 'manual refresh updates loaded pages');
  assert.deepEqual(await evaluate('window.review.feedRequests'), [1, 2, 2, 1, 2]);
  await evaluate(`document.querySelector('button[aria-label="Xem ảnh 5 của bài viết Nhà phố 5 × 20m"]').click()`);
  await waitFor(`document.querySelector('[role="dialog"] [role="status"]')?.textContent.includes('5 / 7')`, 'clicked fifth photo');
  assert.equal(await evaluate('location.pathname'), '/');
  await evaluate(`document.querySelector('button[aria-label="Ảnh tiếp theo"]').click()`);
  await waitFor(`document.querySelector('[role="dialog"] [role="status"]')?.textContent.includes('6 / 7')`, 'sixth hidden photo');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await waitFor(`document.querySelector('[role="dialog"] [role="status"]')?.textContent.includes('7 / 7')`, 'keyboard navigation');
  await evaluate(`document.querySelector('button[aria-label="Phóng to ảnh"]').click()`);
  assert.equal(await evaluate(`document.querySelector('button[aria-label="Thu nhỏ ảnh"]').getAttribute('aria-pressed')`), 'true');
  await evaluate(`document.querySelector('button[aria-label="Thu nhỏ ảnh"]').click()`);
  await waitFor(`document.querySelector('[role="dialog"] textarea') && document.querySelector('[role="dialog"]').innerText.includes('Bình luận có ảnh')`, 'comments in viewer');
  assert.equal(await evaluate(`document.querySelector('[role="dialog"] aside').getBoundingClientRect().width`), 380);
  writeFileSync(path.join(dir, 'desktop-viewer.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await evaluate(`document.querySelector('[role="dialog"] button[data-requires-account][aria-pressed="false"]').click()`);
  await waitFor(`window.review.liked`, 'like persisted');
  await evaluate(`document.querySelector('button[aria-label="Đóng trình xem ảnh"]').click()`);
  await waitFor(`!document.querySelector('[role="dialog"]')`, 'viewer close');
  assert.equal(await evaluate(`document.querySelector('article button[aria-pressed="true"]')?.textContent.includes('Đã thích')`), true);
  assert.equal(await evaluate(`document.activeElement.getAttribute('aria-label')`), 'Xem ảnh 5 của bài viết Nhà phố 5 × 20m');
  const photoBytes = readFileSync('public/community-house.png').toString('base64');
  await evaluate(`(() => { const raw = atob(${JSON.stringify(photoBytes)}); const data = Uint8Array.from(raw, c => c.charCodeAt(0)); const transfer = new DataTransfer(); transfer.items.add(new File([data], 'review.png', { type: 'image/png' })); const input = document.querySelector('input[aria-label="Thêm ảnh bình luận"]'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitFor(`document.querySelector('button[aria-label="Bỏ ảnh bình luận"]')`, 'uploaded image preview');
  assert.equal(await evaluate('window.review.uploads[0].type'), 'image/webp');
  assert.ok(await evaluate('window.review.uploads[0].size <= 256 * 1024'));
  await evaluate(`window.review.failSend = true; document.querySelector('button[aria-label="Gửi bình luận"]').click()`);
  await waitFor(`document.querySelector('article [role="alert"]')`, 'failed comment feedback');
  assert.ok(await evaluate(`Boolean(document.querySelector('button[aria-label="Bỏ ảnh bình luận"]'))`));
  await evaluate(`window.review.failSend = false; document.querySelector('button[aria-label="Gửi bình luận"]').click()`);
  await waitFor(`window.review.comments.length === 2 && !document.querySelector('button[aria-label="Bỏ ảnh bình luận"]')`, 'image-only comment sent');
  assert.equal(await evaluate('window.review.lastBody.content'), '');
  assert.ok(await evaluate('window.review.lastBody.imageKey'));
  await evaluate(`(() => { const input = document.querySelector('textarea'); const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(input, 'Bình luận nhiều dòng\\nGiá 250000đ'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await evaluate(`document.querySelector('button[aria-label="Gửi bình luận"]').click()`);
  await waitFor(`window.review.comments.length === 3`, 'text comment sent');
  assert.ok(await evaluate(`document.querySelector('article').innerText.includes('Giá 250.000đ')`));
  await evaluate(`document.querySelector('button[aria-label="Xem ảnh bình luận của Người đọc"]').click()`);
  await waitFor(`document.querySelector('[role="dialog"] [role="status"]')?.textContent.includes('1 / 1')`, 'comment photo viewer');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await waitFor(`!document.querySelector('[role="dialog"]')`, 'escape closes');
  assert.equal(await evaluate(`document.activeElement.getAttribute('aria-label')`), 'Xem ảnh bình luận của Người đọc');
  await evaluate(`window.scrollTo(0,0)`);
  writeFileSync(path.join(dir, 'desktop.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  for (const width of [320, 375, 390, 430, 768, 1023]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
    await pause(100);
    const layout = await evaluate(`(() => {
      const bounds = element => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, width: rect.width }; };
      const filters = document.querySelector('[aria-label="Lọc bảng tin"]');
      return {
        viewport: innerWidth,
        elements: [filters.parentElement, document.querySelector('section[aria-label="Bài đăng mới"]'), ...document.querySelectorAll('article')].map(bounds),
        filterWidth: filters.clientWidth,
        filterScrollWidth: filters.scrollWidth,
        featuredHidden: getComputedStyle(document.querySelector('[aria-labelledby="featured-news-heading"]')).display === 'none',
      };
    })()`);
    if (width === 390) writeFileSync(path.join(dir, 'mobile-feed.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    assert.equal(layout.viewport, width, 'Mobile content must not expand the layout viewport');
    assert.ok(layout.elements.every(rect => rect.left >= 0 && rect.right <= width + 1), `Feed cards and filters must fit the ${width}px viewport: ${JSON.stringify(layout)}`);
    assert.equal(layout.featuredHidden, true);
    if (width <= 430) {
      assert.ok(layout.filterScrollWidth > layout.filterWidth, `Categories must scroll within their own row at ${width}px`);
      await evaluate(`document.querySelector('[aria-label="Lọc bảng tin"]').scrollLeft = 10000`);
      assert.ok(await evaluate(`document.querySelector('[aria-label="Lọc bảng tin"]').scrollLeft > 0 && document.querySelector('article').getBoundingClientRect().right <= innerWidth + 1`), 'Scrolling categories must keep posts within the viewport');
    }
  }
  assert.deepEqual(await evaluate('window.reviewErrors'), [], 'Resizing the feed with comments open must not trigger script or ResizeObserver errors');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate(`document.querySelector('button[aria-label="Xem ảnh 1 của bài viết Nhà phố 5 × 20m"]').click()`);
  await waitFor(`document.querySelector('[role="dialog"]')`, 'mobile viewer');
  await pause(350);
  assert.equal(await evaluate(`document.querySelector('[role="dialog"]').getBoundingClientRect().width`), 390);
  assert.ok(await evaluate(`document.querySelector('[role="dialog"] aside').getBoundingClientRect().height > 200`));
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth`));
  await evaluate(`(() => { const area = document.querySelector('[role="dialog"] img[alt="Ảnh 1"]').parentElement; const start = new Touch({ identifier: 1, target: area, clientX: 300, clientY: 200 }); const end = new Touch({ identifier: 1, target: area, clientX: 80, clientY: 210 }); area.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start], changedTouches: [start], targetTouches: [start] })); area.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [end] })); })()`);
  await waitFor(`document.querySelector('[role="dialog"] [role="status"]')?.textContent.includes('2 / 7')`, 'mobile swipe');
  writeFileSync(path.join(dir, 'mobile-viewer.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await evaluate(`document.querySelector('button[aria-label="Đóng trình xem ảnh"]').click()`);
  await evaluate(`Array.from(document.querySelectorAll('aside button')).find(button => button.textContent === 'Bảng tin').click()`);
  await waitFor(`document.querySelectorAll('article').length === 1 && document.querySelector('article').textContent.includes('Nội dung bài đăng tiếp theo')`, 'category filtering resets loaded pages');
  await evaluate(`Array.from(document.querySelectorAll('aside button')).find(button => button.textContent === 'Tất cả').click()`);
  await waitFor(`document.querySelector('button[aria-label="Xem ảnh 1 của bài viết Nhà phố 5 × 20m"]')`, 'reset category');
  await send('Page.navigate', { url: origin + '/bai-viet/' + fixtureId });
  await waitFor(`document.querySelector('textarea[aria-label="Nội dung bình luận"]')`, 'detail page automatically loads comments');
  assert.equal(await evaluate('location.pathname'), '/bai-viet/' + fixtureId);
  for (const [category, sourcePath] of [['Bản vẽ cộng đồng', '/file-ban-ve-nha-dep-chat'], ['Bộ sưu tập ảnh', '/kho-mau-nha-dep-chat'], ['Nội thất cộng đồng', '/noi-that']]) {
    await send('Page.navigate', { url: origin });
    await waitFor(`document.querySelector('button[aria-label="Xem ảnh 1 của bài viết Nhà phố 5 × 20m"]')`, 'feed for source navigation');
    await evaluate(`window.review.sourceCategory = ${JSON.stringify(category)}; window.dispatchEvent(new Event('nhadepchat-content-changed'))`);
    await pause(350);
    await waitFor(`Array.from(document.querySelectorAll('article a')).some(link => link.getAttribute('href') === ${JSON.stringify(sourcePath + '?postId=' + fixtureId + '#post-' + fixtureId)})`, 'original source link');
    await evaluate(`Array.from(document.querySelector('article').querySelectorAll('a')).find(link => link.textContent.includes('Xem bài viết')).click()`);
    await waitFor(`location.pathname === ${JSON.stringify(sourcePath)} && new URLSearchParams(location.search).get('postId') === '${fixtureId}' && document.getElementById('post-${fixtureId}')`, 'opens original post in ' + sourcePath);
    assert.equal(await evaluate('location.hash'), '#post-' + fixtureId);
    assert.equal(await evaluate(`document.querySelectorAll('article[id^="post-"]').length`), 1);
    assert.ok(await evaluate(`document.getElementById('post-${fixtureId}').textContent.includes('Nhà phố 5 × 20m')`));
  }
  await send('Page.navigate', { url: origin + '/?review-admin=1' });
  await waitFor(`document.querySelector('article header .admin-post-controls')`, 'admin feed controls');
  const checkAdminHeader = async selector => {
    const layout = await evaluate(`(() => {
      const header = document.querySelector(${JSON.stringify(selector)});
      const info = header.querySelector(':scope > div');
      const controls = header.querySelector('.admin-post-controls');
      const rect = element => { const value = element.getBoundingClientRect(); return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height }; };
      return { header: rect(header), info: rect(info), name: rect(info.firstElementChild), time: rect(info.querySelector('time')), controls: rect(controls), buttons: [...controls.querySelectorAll('button')].map(rect) };
    })()`);
    assert.ok(layout.info.width >= 140, 'Admin controls must leave room for the author and date: ' + JSON.stringify(layout));
    assert.ok(layout.name.height <= 48 && layout.time.height <= 32, 'Author and date must not wrap one character per line');
    assert.ok(layout.controls.top >= layout.info.bottom, 'Admin controls must appear below the author details');
    assert.equal(layout.buttons.length, 3, 'Edit, hide and delete must remain available');
    assert.ok(layout.buttons.every(button => button.left >= layout.header.left && button.right <= layout.header.right), 'Admin buttons must fit inside the post header');
  };
  for (const width of [320, 375, 390, 430, 768, 1023, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 1024 });
    await pause(100);
    await checkAdminHeader('article header');
    if (width === 390 || width === 1440) {
      await evaluate(`document.querySelector('article').scrollIntoView({ block: 'center' })`);
      writeFileSync(path.join(dir, `admin-feed-${width}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    }
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate(`document.querySelector('article button[aria-haspopup="dialog"]').click()`);
  await waitFor(`document.querySelector('[role="dialog"] header .admin-post-controls')`, 'admin photo viewer controls');
  await checkAdminHeader('[role="dialog"] header');
  assert.deepEqual(exceptions, []);
  console.log('PASS: feed fits 320–1023px; admin author/date and all three controls fit 320–1440px and the mobile photo viewer; desktop/mobile photos and comments; retries, likes, prices, infinite scroll; View post navigates to the exact original post in House Models, Drawings and Interiors.');
  console.log('Screenshots: ' + dir);
} finally { socket?.close(); chrome.kill(); }
