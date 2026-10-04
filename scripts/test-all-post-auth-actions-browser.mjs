import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const origin=process.env.TIPOOK_TEST_ORIGIN||'http://127.0.0.1:8788';
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'Local fixtures only');
const dir=path.resolve('.sites-runtime/all-post-auth-actions-review');mkdirSync(dir,{recursive:true});
const username='return_'+crypto.randomUUID().slice(0,8),password='fixture-password-123';
const request=async(url,body,cookie,method='POST',status=200)=>{const r=await fetch(origin+url,{method,headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});assert.equal(r.status,status,await r.clone().text());return {data:await r.json(),cookie:r.headers.getSetCookie().find(v=>v.startsWith('tipook_auth_session='))?.split(';')[0]};};
const {cookie}=await request('/api/auth/register',{username,password,name:'Return Fixture'});
await request('/api/professional-profile',{accountType:'engineer'},cookie,'PUT');
const upload=async(purpose)=>{const form=new FormData();form.set('purpose',purpose);form.set('file',new File([purpose==='drawing-file'?'%PDF-1.4\nlocal fixture':readFileSync('scripts/fixtures/upload.webp')],purpose==='drawing-file'?'fixture.pdf':'fixture.webp',{type:purpose==='drawing-file'?'application/pdf':'image/webp'}));const r=await fetch(origin+'/api/files',{method:'POST',headers:{cookie},body:form});assert.equal(r.status,201,await r.clone().text());return (await r.json()).attachment;};
const fixtures=[];
for(const [category,base] of [['Bảng tin','/'],['Bộ sưu tập ảnh','/kho-mau-nha-dep-chat'],['Bản vẽ cộng đồng','/file-ban-ve-nha-dep-chat'],['Nội thất cộng đồng','/noi-that']]){
 const title='Return '+crypto.randomUUID().slice(0,8);
 const {data}=await request('/api/posts',{category,title,content:title,priceLabel:category==='Bản vẽ cộng đồng'||category==='Nội thất cộng đồng'?'5000':undefined,attachments:[await upload('drawing-preview')],...(['Bản vẽ cộng đồng','Nội thất cộng đồng'].includes(category)?{paidFiles:[await upload('drawing-file')]}:{})},cookie,'POST',201);
 fixtures.push({id:data.post.id,title,base});
}
const chrome=spawn(process.env.TIPOOK_BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9231',`--user-data-dir=${path.join(dir,'chrome')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));let socket,send;
try{
 let tabs;for(let i=0;i<80;i++){try{tabs=await(await fetch('http://127.0.0.1:9231/json/list')).json();break;}catch{await pause(250);}}
 assert.ok(tabs?.length,'Chrome must start');socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
 let seq=0;const pending=new Map(),exceptions=[],documents=[];
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(new Error(JSON.stringify(m.error)));else p?.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.method==='Network.requestWillBeSent'&&m.params.type==='Document')documents.push(m.params.request.url);});
 send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(new Error('CDP timeout '+method)),30000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const wait=async(expression)=>{for(let i=0;i<300;i++){if(await evaluate(`Boolean(${expression})`))return;await pause(100);}writeFileSync(path.join(dir,'failure.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));throw new Error('Timeout '+expression+'\n'+await evaluate('location.href+"\\n"+document.body.innerText.slice(0,2000)'));};
 const click=async(selector)=>{await wait(`document.querySelector(${JSON.stringify(selector)})`);await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 const records=[];
 const loginUsers=[username];for(let i=0;i<3;i++){const user='login_'+crypto.randomUUID().slice(0,8);await request('/api/auth/register',{username:user,password,name:'Login Fixture'});loginUsers.push(user);}
 const specs=[
  {fixture:fixtures[0],actions:['Thích','Chia sẻ','comment','comment-image','photo-like']},
  {fixture:fixtures[1],actions:['Yêu thích','Chia sẻ','Hỏi chuyên gia','comment','comment-image']},
  {fixture:fixtures[2],actions:['Lưu bản vẽ','Chia sẻ','Yêu cầu file','Đặt mua','Đánh giá 5 sao']},
  {fixture:fixtures[3],actions:['Chia sẻ','Yêu cầu file','Đặt mua','Đánh giá 5 sao']},
  {fixture:{base:'/file-ban-ve-nha-dep-chat',model:true},actions:['Lưu bản vẽ','Chia sẻ','Yêu cầu file','Đặt mua','Đánh giá 5 sao']},
  {fixture:{base:'/kho-mau-nha-dep-chat',model:true},actions:['Lưu mẫu','Yêu thích','Chia sẻ','Hỏi chuyên gia','comment','comment-image']},
 ];
 const freeImage=await upload('drawing-preview'),freeFile=await upload('drawing-file');
 const {data:free}=await request('/api/posts',{category:'Bản vẽ cộng đồng',title:'Free Return '+crypto.randomUUID().slice(0,8),attachments:[freeImage],paidFiles:[freeFile]},cookie,'POST',201);
 specs.push({fixture:{id:free.post.id,title:free.post.title,base:'/file-ban-ve-nha-dep-chat'},actions:['Tải miễn phí']});
 let index=0;
 for(const {fixture:original,actions} of specs)for(const action of actions)for(const mode of ['login','register']){
  const fixture={...original},register=mode==='register';
  await send('Network.clearBrowserCookies');await send('Page.navigate',{url:origin+fixture.base+(fixture.base==='/'||fixture.model?'':'?q='+encodeURIComponent(fixture.title)+'&sort=views')});
  await wait(fixture.model?`document.querySelector('article[data-auth-model-query]') && window.next?.router`:`document.querySelector('#post-${fixture.id}') && window.next?.router`);await pause(250);
  if(fixture.model){fixture.title=await evaluate(`document.querySelector('article[data-auth-model-query]').getAttribute('data-auth-model-query')`);fixture.anchor='model-'+encodeURIComponent(fixture.title);}else fixture.anchor='post-'+fixture.id;
  const article='article[id='+JSON.stringify(fixture.anchor)+']';
  await wait(`document.querySelector(${JSON.stringify(article)})`);
  const actionSelector=await evaluate(`(() => {const root=document.querySelector(${JSON.stringify(article)}); const action=${JSON.stringify(action)};const matches=Array.from(root.querySelectorAll('button'));let button;if(action==='comment'||action==='comment-image')button=matches.find(b=>(b.getAttribute('aria-label')||b.textContent).trim().startsWith('Bình luận'));else if(action==='photo-like')button=root.querySelector('button[aria-haspopup="dialog"]');else button=matches.find(b=>(b.getAttribute('aria-label')||'').trim().startsWith(action)||b.textContent.trim().startsWith(action));if(!button)return null;button.dataset.authTestClick='target';return '[data-auth-test-click="target"]';})()`);
  assert.ok(actionSelector,'Action must exist: '+fixture.base+' '+action);await evaluate('window.authReturnSentinel="still-mounted"');const documentCount=documents.length;
  await click(actionSelector);
  if(action==='comment'||action==='comment-image'){
   const root=fixture.base==='/'?article:`[role="dialog"][data-auth-${fixture.model?'model-query':'post-id'}=${JSON.stringify(fixture.model?fixture.title:String(fixture.id))}]`;
   await wait(`document.querySelector(${JSON.stringify(root)})`);
   await click(root+(action==='comment'?' [placeholder="Viết bình luận..."]':fixture.base==='/'?' label[title="Thêm ảnh bình luận"]':' [aria-label="Thêm ảnh"]'));
  }else if(action==='photo-like')await click(`[role="dialog"][data-auth-post-id="${fixture.id}"] button[data-requires-account]`);
  const authPath=register?'/dang-ky':'/dang-nhap',selector=`[role="dialog"] a[href^="${authPath}?"]`;
  await wait(`document.querySelector(${JSON.stringify(selector)})`);
  const target=await evaluate(`new URL(document.querySelector(${JSON.stringify(selector)}).href).searchParams.get('return_to')`),url=new URL(target,origin);
  assert.equal(url.hash,'#'+fixture.anchor,'Return must anchor exact card');assert.equal(url.searchParams.get('page'),null);
  if(fixture.model){assert.equal(url.pathname,fixture.base);assert.equal(url.searchParams.get('q'),fixture.title);assert.equal(url.searchParams.get('postId'),null);}else if(fixture.base!=='/'){assert.equal(url.searchParams.get('q'),fixture.title);assert.equal(url.searchParams.get('sort'),'views');assert.equal(url.searchParams.get('postId'),String(fixture.id));}else assert.equal(target,`/bai-viet/${fixture.id}#post-${fixture.id}`);
  await click(selector);await wait(`location.pathname===${JSON.stringify(authPath)} && document.querySelector('.auth-form[data-ready="true"]') && document.querySelector('input[name="${register?'username':'login'}"]')`);
  await evaluate(`(() => {const values=${JSON.stringify(register?{name:'New Return User',username:'new_'+crypto.randomUUID().slice(0,8),password}:{login:loginUsers[Math.floor(index/2)%loginUsers.length],password})};for(const [name,value] of Object.entries(values)){const input=document.querySelector('.auth-form input[name="'+name+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('.auth-form').requestSubmit();})()`);
  await wait(`location.pathname+location.search+location.hash===${JSON.stringify(target)} && document.querySelector(${JSON.stringify(article)})`);await pause(400);
  assert.equal(await evaluate('window.authReturnSentinel'),'still-mounted');assert.equal(documents.length,documentCount,'No document reload');assert.ok(await evaluate('(async()=>!!(await(await fetch("/api/me")).json()).user)()'));
  const placement=await evaluate(`(() => {const r=document.querySelector(${JSON.stringify(article)}).getBoundingClientRect();return {top:r.top,bottom:r.bottom};})()`);assert.ok(placement.top<1000&&placement.bottom>0,'Returned card must be visible');
  if(['Đặt mua','Tải miễn phí'].includes(action)){
   await click(article+' button[aria-label='+JSON.stringify(action)+']');await wait(`Array.from(document.querySelectorAll('[role="dialog"]')).some(d=>d.innerText.includes('Thanh toán bằng Ví NhàĐẹpChất')&&d.innerText.includes(${JSON.stringify(fixture.title)}))`);
   assert.equal(await evaluate(`Array.from(document.querySelectorAll('[role="dialog"]')).some(d=>d.innerText.includes('Đăng ký để sử dụng chức năng'))`),false,'Authenticated purchase must open correct title');
  }
  const record={base:fixture.base,kind:fixture.model?'catalog-model':'member-post',action,mode,target,noDocumentReload:true};records.push(record);console.log('PASS '+(++index)+' '+fixture.base+' '+(fixture.model?'model ':'post ')+action+' '+mode);
 }
 assert.deepEqual(exceptions,[],'No browser exceptions');writeFileSync(path.join(dir,'results.json'),JSON.stringify(records,null,2));
 console.log('PASS: '+records.length+' real local login/register flows cover every post action, model/member cards, purchase/free download, rating and comment/photo portals; exact card is visible without document reload.');
}finally{if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}socket.close();}chrome.kill();}
