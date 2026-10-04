import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const origin=process.env.TIPOOK_TEST_ORIGIN||'http://127.0.0.1:8788';
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'Local fixtures only');
const dir=path.resolve('.sites-runtime/auth-return-review');mkdirSync(dir,{recursive:true});
const username='return_'+crypto.randomUUID().slice(0,8),password='fixture-password-123';
const request=async(url,body,cookie,method='POST',status=200)=>{const r=await fetch(origin+url,{method,headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});assert.equal(r.status,status,await r.clone().text());return {data:await r.json(),cookie:r.headers.getSetCookie().find(v=>v.startsWith('tipook_auth_session='))?.split(';')[0]};};
const {cookie}=await request('/api/auth/register',{username,password,name:'Return Fixture'});
await request('/api/professional-profile',{accountType:'engineer'},cookie,'PUT');
const upload=async(purpose)=>{const form=new FormData();form.set('purpose',purpose);form.set('file',new File([purpose==='drawing-file'?'%PDF-1.4\nlocal fixture':readFileSync('scripts/fixtures/upload.webp')],purpose==='drawing-file'?'fixture.pdf':'fixture.webp',{type:purpose==='drawing-file'?'application/pdf':'image/webp'}));const r=await fetch(origin+'/api/files',{method:'POST',headers:{cookie},body:form});assert.equal(r.status,201,await r.clone().text());return (await r.json()).attachment;};
const fixtures=[];
for(const [category,base] of [['Bảng tin','/'],['Bộ sưu tập ảnh','/kho-mau-nha-dep-chat'],['Bản vẽ cộng đồng','/file-ban-ve-nha-dep-chat'],['Nội thất cộng đồng','/noi-that']]){
 const title='Return '+crypto.randomUUID().slice(0,8);
 const {data}=await request('/api/posts',{category,title,content:title,attachments:[await upload('drawing-preview')],...(['Bản vẽ cộng đồng','Nội thất cộng đồng'].includes(category)?{paidFiles:[await upload('drawing-file')]}:{})},cookie,'POST',201);
 fixtures.push({id:data.post.id,title,base});
}
const chrome=spawn(process.env.TIPOOK_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9229',`--user-data-dir=${path.join(dir,'chrome')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));let socket,send;
try{
 let tabs;for(let i=0;i<80;i++){try{tabs=await(await fetch('http://127.0.0.1:9229/json/list')).json();break;}catch{await pause(250);}}
 assert.ok(tabs?.length,'Chrome must start');socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
 let seq=0;const pending=new Map(),exceptions=[],documents=[];
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(new Error(JSON.stringify(m.error)));else p?.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.method==='Network.requestWillBeSent'&&m.params.type==='Document')documents.push(m.params.request.url);});
 send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(new Error('CDP timeout '+method)),30000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const wait=async(expression)=>{for(let i=0;i<300;i++){if(await evaluate(`Boolean(${expression})`))return;await pause(100);}writeFileSync(path.join(dir,'failure.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));throw new Error('Timeout '+expression+'\n'+await evaluate('location.href+"\\n"+document.body.innerText.slice(0,2000)'));};
 const click=async(selector)=>{await wait(`document.querySelector(${JSON.stringify(selector)})`);await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 const records=[];
 for(let index=0;index<6;index++){
  const fixture=fixtures[index<4?index:index===4?0:1],register=index===0;
  await send('Network.clearBrowserCookies');await send('Page.navigate',{url:origin+fixture.base+(fixture.base==='/'?'':'?q='+encodeURIComponent(fixture.title)+'&sort=views')});
  await wait(`document.querySelector('#post-${fixture.id}') && window.next?.router`);await pause(600);
  await evaluate('window.authReturnSentinel="still-mounted"');const documentCount=documents.length;
  if(index===4){await click(`#post-${fixture.id} button[aria-haspopup="dialog"]`);await wait(`document.querySelector('[role="dialog"][data-auth-post-id="${fixture.id}"]')`);await click(`[role="dialog"][data-auth-post-id="${fixture.id}"] button[data-requires-account]`);}
  else if(index===5){await click(`#post-${fixture.id} button[aria-label^="Bình luận"]`);await wait(`document.querySelector('[role="dialog"][data-auth-post-id="${fixture.id}"]')`);await click(`[role="dialog"][data-auth-post-id="${fixture.id}"] input[placeholder="Viết bình luận..."]`);}
  else await click(`#post-${fixture.id} button[data-requires-account]`);
  const authPath=register?'/dang-ky':'/dang-nhap';const selector=`[role="dialog"] a[href^="${authPath}?"]`;
  await wait(`document.querySelector(${JSON.stringify(selector)})`);
  const target=await evaluate(`new URL(document.querySelector(${JSON.stringify(selector)}).href).searchParams.get('return_to')`);
  assert.equal(new URL(target,origin).hash,`#post-${fixture.id}`);
  if(fixture.base!=='/'){assert.equal(new URL(target,origin).searchParams.get('q'),fixture.title);assert.equal(new URL(target,origin).searchParams.get('sort'),'views');assert.equal(new URL(target,origin).searchParams.get('postId'),String(fixture.id));}
  else assert.equal(target,`/bai-viet/${fixture.id}#post-${fixture.id}`);
  await click(selector);await wait(`location.pathname===${JSON.stringify(authPath)} && document.querySelector('.auth-form[data-ready="true"]')`);
  if(index===1){await click('.auth-mode a[href^="/dang-ky?"]');await wait(`location.pathname==='/dang-ky' && document.querySelector('input[name="username"]')`);await click('.auth-mode a[href^="/dang-nhap?"]');await wait(`location.pathname==='/dang-nhap' && document.querySelector('input[name="login"]')`);assert.equal(await evaluate('new URL(location.href).searchParams.get("return_to")'),target);}
  await evaluate(`(() => {const values=${JSON.stringify(register?{name:'New Return User',username:'new_'+crypto.randomUUID().slice(0,8),password}:{login:username,password})};for(const [name,value] of Object.entries(values)){const input=document.querySelector('.auth-form input[name="'+name+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('.auth-form').requestSubmit();})()`);
  await wait(`location.pathname+location.search+location.hash===${JSON.stringify(target)} && document.querySelector('#post-${fixture.id}')`);
  await wait(`!document.querySelector('.auth-form')`);await pause(650);
  assert.equal(await evaluate('window.authReturnSentinel'),'still-mounted','Auth navigation must retain document');assert.equal(documents.length,documentCount,'No document reload during authentication');
  assert.ok(await evaluate('(async()=>!!(await(await fetch("/api/me")).json()).user)()'),'Authenticated cookie must work');
  if(index===0){await click(`#post-${fixture.id} button[data-requires-account]`);await pause(250);assert.equal(await evaluate(`Array.from(document.querySelectorAll('[role="dialog"]')).some(d=>d.innerText.includes('Đăng ký để sử dụng chức năng'))`),false,'Member provider must refresh after authentication');}
  records.push({base:fixture.base,mode:register?'register':'login',portal:index===4?'photo':index===5?'comment':null,target,noDocumentReload:true});console.log('PASS '+JSON.stringify(records.at(-1)));
 }
 assert.deepEqual(exceptions,[],'No browser exceptions');writeFileSync(path.join(dir,'results.json'),JSON.stringify(records,null,2));
 console.log('PASS: actual local D1/R2 login/registration returns exact posts in all catalogs and portals; mode switches preserve target; no document reload.');
}finally{if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}socket.close();}chrome.kill();}
