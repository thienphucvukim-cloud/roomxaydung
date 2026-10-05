// Browser fixtures intercept only this session's requests; no real records are written.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const origin=process.env.TIPOOK_TEST_ORIGIN || 'http://localhost:5173';
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const directory=path.resolve('.sites-runtime/freelance-review');mkdirSync(directory,{recursive:true});
const chrome=spawn(process.env.TIPOOK_BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--remote-debugging-port=9239',`--user-data-dir=${path.join(directory,'chrome')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
  let pages;
  for(let i=0;i<80;i++){try{pages=await(await fetch('http://127.0.0.1:9239/json/list')).json();if(pages.length)break;}catch{}await pause(250);}
  assert.ok(pages?.some(page=>page.type==='page'),'Chrome must start');
  socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
  const pending=new Map(),exceptions=[];let sequence=0;
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);pending.delete(message.id);if(message.error)task?.reject(Error(JSON.stringify(message.error)));else task?.resolve(message.result);}if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>reject(Error('CDP timeout: '+method)),30000);pending.set(id,{resolve:result=>{clearTimeout(timer);resolve(result);},reject:error=>{clearTimeout(timer);reject(error);}});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);return result.result.value;};
  const waitFor=async expression=>{for(let i=0;i<200;i++){if(await evaluate('Boolean('+expression+')'))return;await pause(100);}throw Error('Timeout: '+expression+'\n'+await evaluate('document.body.innerText.slice(-3500)'));};
  const click=async(selector,text)=>{
    await waitFor(`Array.from(document.querySelectorAll(${JSON.stringify(selector)})).some(e=>e.textContent.includes(${JSON.stringify(text)}))`);
    await evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(e=>e.textContent.includes(${JSON.stringify(text)})).scrollIntoView({block:'center',inline:'center'})`);
    await pause(100);
    const point=await evaluate(`(()=>{const e=Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(e=>e.textContent.includes(${JSON.stringify(text)})),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  };
  const setInput=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const submit=async fields=>{await evaluate(`(()=>{const form=document.querySelector('[role="dialog"] form');for(const [key,value] of Object.entries(${JSON.stringify(fields)})){const field=form.elements.namedItem(key);if(!field)throw Error('Missing: '+key);if(field.type==='checkbox')field.checked=value;else field.value=value;}if(!form.checkValidity())throw Error('Invalid form');form.requestSubmit();})()`);};
  const screenshot=async name=>{await pause(300);writeFileSync(path.join(directory,name+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));};
  const noOverflow=async()=>assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'No horizontal overflow');
  await send('Runtime.enable');await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
    const native=fetch.bind(window),now=new Date().toISOString(),id='11111111-1111-4111-8111-111111111111';
    const profiles=[
      {id:'expert',name:'Nguyễn Minh An',title:'Kiến trúc sư · Nhà ở hiện đại',specialty:'Thiết kế kiến trúc',location:'TP. Hồ Chí Minh',bio:'Thiết kế những ngôi nhà thoáng sáng, gần gũi thiên nhiên. Cùng bạn từ ý tưởng kiến trúc đến hồ sơ thi công.',skills:['AutoCAD','SketchUp','Nhà phố'],experience:8,rate:180000,rateUnit:'m2',available:true,cover:'/mau-nha-pho-xanh.png',portfolio:[{title:'Nhà phố với khoảng xanh',url:'https://example.com/nha-pho'}],completedCount:12,updatedAt:now},
      {id:'interior',name:'Trần Khánh Linh',title:'Thiết kế nội thất · Không gian sống',specialty:'Thiết kế nội thất',location:'Hà Nội',bio:'Tối ưu không gian và chất liệu để tạo nên những căn nhà mang dấu ấn riêng của mỗi gia đình.',skills:['3ds Max','V-Ray','Nội thất'],experience:5,rate:250000,rateUnit:'m2',available:true,cover:'/community-house.png',portfolio:[],completedCount:7,updatedAt:now},
      {id:'engineer',name:'Lê Trọng Hiếu',title:'Kỹ sư xây dựng · Kết cấu công trình',specialty:'Thiết kế kết cấu',location:'Đà Nẵng',bio:'Tư vấn giải pháp kết cấu, triển khai hồ sơ kỹ thuật rõ ràng và phối hợp với kiến trúc sư.',skills:['Revit','ETABS','BIM'],experience:10,rate:120000,rateUnit:'m2',available:false,cover:'/mat-bang-5x20.png',portfolio:[],completedCount:16,updatedAt:now}
    ];for(let i=0;i<4;i++)profiles.push({...profiles[i%3],id:'extra-'+i,name:'Freelancer kiểm thử '+i});
    const project={id,ownerId:'buyer',ownerName:'Nguyễn Hoàng',freelancerId:null,title:'Thiết kế nhà phố 5 × 20m, 3 tầng',specialty:'Thiết kế kiến trúc',description:'Gia đình 4 người cần thiết kế nhà phố hiện đại, ưu tiên ánh sáng tự nhiên. Khu đất 5 × 20m, 3 tầng, có sân trước và khoảng thông tầng. Cần hồ sơ kiến trúc đầy đủ để triển khai thi công.',location:'Thủ Đức, TP. Hồ Chí Minh',budget:15000000,days:21,status:'open',agreedPrice:0,agreedDays:0,proposalCount:1,createdAt:now,updatedAt:now};
    window.review={actor:{id:'buyer',name:'Nguyễn Hoàng'},profiles,projects:[project],proposals:[{id:'quote',projectId:id,freelancerId:'expert',name:'Nguyễn Minh An',title:'Kiến trúc sư nhà ở',price:12000000,days:21,content:'Phát triển phương án kiến trúc, triển khai hồ sơ PDF + DWG và phối cảnh JPG. Bao gồm hai lần chỉnh sửa.',createdAt:now}],messages:[],directMessages:[],files:[],requests:[],empty:false,fail:false,failMessage:false,failQuote:false};
    window.fetch=async(input,init={})=>{
      const url=new URL(typeof input==='string'?input:input.url,location.origin),method=init.method||'GET',r=window.review;
      const json=(value,status=200)=>Promise.resolve(new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}}));
      if(url.pathname==='/api/me')return json({user:{id:r.actor?.id,name:r.actor?.name||'Khách',authenticated:!!r.actor,isAdmin:false,accountType:'user'}});
      if(url.pathname==='/api/messages'){
        if(method==='PATCH')return json({ok:true});
        if(method==='POST'){
          const body=JSON.parse(init.body);r.requests.push({...body,kind:'direct-message'});
          if(r.failMessage)return json({error:'Chưa gửi được tin nhắn thử nghiệm.'},503);
          const message={id:r.directMessages.length+1,senderUserId:r.actor.id,senderName:r.actor.name,recipientUserId:body.peerId,subject:'Tin nhắn',content:body.content,createdAt:now};r.directMessages.push(message);return json({message},201);
        }
        const peerId=url.searchParams.get('peerId');
        if(peerId)return json({currentUserId:r.actor.id,peerId,peerName:r.profiles.find(p=>p.id===peerId)?.name||'Nguyễn Hoàng',hasMore:false,messages:r.directMessages.filter(m=>(m.senderUserId===r.actor.id&&m.recipientUserId===peerId)||(m.senderUserId===peerId&&m.recipientUserId===r.actor.id))});
        return json({messages:r.directMessages.filter(m=>m.recipientUserId===r.actor?.id)});
      }
      if(url.pathname==='/api/freelance'){
        r.lastQuery=Object.fromEntries(url.searchParams);if(r.fail)return json({error:'Lỗi kiểm thử kết nối'},503);
        const view=url.searchParams.get('view'),q=(url.searchParams.get('q')||'').toLowerCase(),specialty=url.searchParams.get('specialty'),page=Number(url.searchParams.get('page')||1);
        let rows=r.empty?[]:view==='freelancers'?r.profiles:r.projects.filter(p=>view==='mine'?p.ownerId===r.actor?.id||p.freelancerId===r.actor?.id||r.proposals.some(q=>q.projectId===p.id&&q.freelancerId===r.actor?.id):p.status==='open');
        rows=rows.filter(item=>(!specialty||item.specialty===specialty)&&(!q||JSON.stringify(item).toLowerCase().includes(q)));
        if(view==='freelancers'&&url.searchParams.get('available')==='1')rows=rows.filter(item=>item.available);
        return json({profiles:view==='freelancers'?rows.slice((page-1)*6,page*6):[],projects:view==='freelancers'?[]:rows.slice((page-1)*6,page*6),total:rows.length,page,actor:r.actor,profile:r.profiles.find(p=>p.id===r.actor?.id)||null});
      }
      if(url.pathname==='/api/freelance/profiles'){
        if(method==='GET')return json({profile:r.profiles.find(p=>p.id===url.searchParams.get('id')),actor:r.actor});
        const body=JSON.parse(init.body),profile={...body,id:r.actor.id,name:r.actor.name,skills:body.skills.split(',').map(s=>s.trim()).filter(Boolean),completedCount:0,updatedAt:now};r.requests.push(body);r.profiles=r.profiles.filter(p=>p.id!==profile.id).concat(profile);return json({profile});
      }
      if(url.pathname==='/api/freelance/files'&&method==='POST'){const file=init.body.get('file');r.files.push({id:crypto.randomUUID(),projectId:init.body.get('projectId'),purpose:init.body.get('purpose'),name:file.name,size:file.size,createdAt:now});return json({ok:true});}
      if(url.pathname==='/api/freelance/projects'){
        if(method==='GET'){const p=r.projects.find(p=>p.id===url.searchParams.get('id')),member=r.actor?.id===p.ownerId||r.actor?.id===p.freelancerId;return json({project:p,actor:r.actor,profile:r.profiles.find(p=>p.id===r.actor?.id)||null,proposals:r.proposals.filter(q=>q.projectId===p.id&&(r.actor?.id===p.ownerId||q.freelancerId===r.actor?.id)),messages:member?r.messages:[],files:r.files.filter(f=>f.projectId===p.id&&(f.purpose==='brief'||member))});}
        const body=JSON.parse(init.body);r.requests.push(body);let p=r.projects.find(p=>p.id===body.id);
        if(body.action==='propose'&&r.failQuote)return json({error:'Chưa lưu được báo giá thử nghiệm.'},503);
        if(body.action==='create'){p={...body,id:body.requestId,ownerId:r.actor.id,ownerName:r.actor.name,freelancerId:null,status:'open',agreedPrice:0,agreedDays:0,proposalCount:0,createdAt:now,updatedAt:now};r.projects.push(p);}
        if(body.action==='hire'){const q=r.proposals.find(q=>q.id===body.proposalId);p.freelancerId=q.freelancerId;p.agreedPrice=q.price;p.agreedDays=q.days;p.status='working';}
        if(body.action==='message')r.messages.push({id:body.requestId,authorId:r.actor.id,authorName:r.actor.name,content:body.content,createdAt:now});
        if(body.action==='deliver')p.status='delivered';if(body.action==='revise')p.status='working';if(body.action==='complete')p.status='completed';if(body.action==='cancel')p.status='cancelled';
        if(body.action==='propose'){const profile=r.profiles.find(p=>p.id===r.actor.id);r.proposals=r.proposals.filter(q=>q.freelancerId!==r.actor.id||q.projectId!==p.id).concat({...body,id:body.requestId,projectId:p.id,freelancerId:r.actor.id,name:r.actor.name,title:profile.title,createdAt:now});p.proposalCount=r.proposals.filter(q=>q.projectId===p.id).length;}
        return json({project:p});
      }
      return native(input,init);
    };
  })();`});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:origin+'/thue-thiet-ke'});
  await waitFor(`document.querySelectorAll('.fm-freelancer-card').length===6`);await noOverflow();await screenshot('market-desktop');
  await click('.fm-pagination button','Sau');await waitFor(`document.querySelectorAll('.fm-freelancer-card').length===1`);
  await setInput('.fm-search input','không có kết quả');await waitFor(`document.querySelector('.fm-empty h3')?.textContent.includes('Chưa có')`);
  await click('.fm-empty button','Xóa bộ lọc');await waitFor(`document.querySelectorAll('.fm-freelancer-card').length===6`);
  await click('.fm-services button','Nội thất');await waitFor(`document.querySelectorAll('.fm-freelancer-card').length===2`);
  assert.equal(await evaluate('window.review.lastQuery.specialty'),'Thiết kế nội thất');
  await click('.fm-filter-heading button','Đặt lại');await waitFor(`document.querySelectorAll('.fm-freelancer-card').length===6`);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await noOverflow();await screenshot('market-mobile');
  await click('.fm-mobile-filter','Bộ lọc');assert.equal(await evaluate(`document.querySelector('.fm-sidebar').classList.contains('fm-filters-open')`),true);await click('.fm-close-filter','');
  await click('.fm-hero-actions button','Đăng dự án');await waitFor(`document.querySelector('[role="dialog"] input[name="title"]')`);await noOverflow();await screenshot('post-mobile');
  assert.equal(await evaluate(`document.querySelector('textarea[name="description"]').required`),false);
  await submit({title:'Vẽ',budget:0,days:0});await waitFor(`document.querySelector('.fm-room-header h1')?.textContent==='Vẽ'`);
  assert.equal(await evaluate(`window.review.requests.find(r=>r.action==='create').specialty`),'Thiết kế kiến trúc');
  await click('.fm-breadcrumb a','Sàn thiết kế');await waitFor(`document.querySelector('.fm-project-card')`);
  await click('.fm-tabs button','Tìm freelancer');await waitFor(`document.querySelector('.fm-freelancer-card')`);
  await click('.fm-freelancer-card a','Xem hồ sơ');await waitFor(`document.querySelector('.fm-profile-intro h1')?.textContent.includes('Minh An')`);await noOverflow();await screenshot('profile-mobile');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await screenshot('profile-desktop');
  await send('Page.navigate',{url:origin+'/thue-thiet-ke?view=projects'});await waitFor(`document.querySelector('.fm-project-card')`);
  await click('.fm-project-card a','Xem báo giá nhận được');await waitFor(`document.querySelector('.fm-room-header') && document.querySelector('.fm-proposal')`);
  await click('.fm-room-tabs button','Đề xuất nhận được');await waitFor(`document.querySelector('.fm-proposal')`);await screenshot('project-desktop');
  await click('.fm-proposal button','Trao đổi báo giá');await waitFor(`document.querySelector('[role="dialog"] textarea[aria-label="Tin nhắn"]')`);
  await setInput('[role="dialog"] textarea[aria-label="Tin nhắn"]','Báo giá có bao gồm hồ sơ kết cấu không?');await click('[role="dialog"] button[aria-label="Gửi tin nhắn"]','');
  await waitFor(`document.querySelector('[role="log"]')?.textContent.includes('hồ sơ kết cấu')`);
  assert.equal(await evaluate('window.review.directMessages.at(-1).recipientUserId'),'expert');
  await click('[role="dialog"] [data-slot="dialog-close"]','');await waitFor(`!document.querySelector('[role="dialog"]')`);
  await evaluate(`window.review.actor={id:'expert',name:'Nguyễn Minh An'};document.querySelector('button[aria-label="Cập nhật dự án"]').click()`);
  await waitFor(`document.querySelector('.fm-project-summary')?.textContent.includes('Cập nhật báo giá')`);
  await click('.fm-project-summary button','Liên hệ người thuê');await waitFor(`document.querySelector('[role="log"]')?.textContent.includes('hồ sơ kết cấu')`);
  await evaluate('window.review.failMessage=true');await setInput('[role="dialog"] textarea[aria-label="Tin nhắn"]','Có, bao gồm hồ sơ kết cấu.');await click('[role="dialog"] button[aria-label="Gửi tin nhắn"]','');
  await waitFor(`document.querySelector('[role="dialog"] [role="alert"]')?.textContent.includes('Chưa gửi được')`);
  assert.equal(await evaluate(`document.querySelector('[role="dialog"] textarea').value`),'Có, bao gồm hồ sơ kết cấu.');
  await evaluate('window.review.failMessage=false');await click('[role="dialog"] button[aria-label="Gửi tin nhắn"]','');await waitFor(`window.review.directMessages.length===2`);
  assert.equal(await evaluate('window.review.directMessages.at(-1).recipientUserId'),'buyer');
  await click('[role="dialog"] [data-slot="dialog-close"]','');await waitFor(`!document.querySelector('[role="dialog"]')`);
  await click('.fm-project-summary button','Cập nhật báo giá');await waitFor(`document.querySelector('[role="dialog"] input[name="price"]')`);
  await evaluate('window.review.failQuote=true');await submit({price:13000000,days:20,content:'Kiến trúc và kết cấu, hồ sơ PDF + DWG.'});await waitFor(`document.querySelector('[role="dialog"] [role="alert"]')`);
  const failedId=await evaluate('window.review.requests.at(-1).requestId');
  await evaluate('window.review.failQuote=false');await submit({price:13000000,days:20,content:'Kiến trúc và kết cấu, hồ sơ PDF + DWG.'});await waitFor(`!document.querySelector('[role="dialog"]') && document.querySelector('.fm-notice')`);
  assert.equal(await evaluate('window.review.requests.at(-1).requestId'),failedId,'Retry the same quote without generating another request');
  assert.ok(await evaluate(`document.querySelector('.fm-proposal').textContent.includes('13.000.000đ')`));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate(`window.review.actor={id:'new-expert',name:'Freelancer mới'};document.querySelector('button[aria-label="Cập nhật dự án"]').click()`);
  await waitFor(`document.querySelector('.fm-project-summary')?.textContent.includes('Tạo hồ sơ để nhận việc')`);
  await click('.fm-project-summary a','Tạo hồ sơ để nhận việc');await waitFor(`document.querySelector('[role="dialog"] textarea[name="bio"]')`);
  await submit({title:'Kiến trúc sư',bio:'Thiết kế nhà phố và triển khai hồ sơ.',skills:'AutoCAD',experience:3,rate:0,rateUnit:'project',cover:'',location:'Đà Nẵng',available:true});
  await waitFor(`document.querySelector('.fm-room-header') && document.querySelector('[role="dialog"] input[name="price"]')`);
  assert.ok(await evaluate(`location.pathname.endsWith('11111111-1111-4111-8111-111111111111')`),'Creating a freelancer profile returns to the chosen project');
  await submit({price:10000000,days:15,content:'Phương án kiến trúc, bản vẽ và phối cảnh.'});await waitFor(`!document.querySelector('[role="dialog"]') && document.querySelector('.fm-proposal')`);await noOverflow();await screenshot('quote-mobile');
  await click('.fm-breadcrumb a','Sàn thiết kế');await waitFor(`document.querySelector('.fm-project-actions')`);
  await click('.fm-project-actions a','Liên hệ người thuê');await waitFor(`document.querySelector('[role="dialog"] textarea[aria-label="Tin nhắn"]')`);await noOverflow();
  await click('[role="dialog"] [data-slot="dialog-close"]','');await waitFor(`!document.querySelector('[role="dialog"]')`);
  await click('.fm-breadcrumb a','Sàn thiết kế');await waitFor(`document.querySelector('.fm-project-actions')`);
  await click('.fm-project-actions a','Báo giá / nhận việc');await waitFor(`document.querySelector('[role="dialog"] input[name="price"]')`);
  await click('[role="dialog"] [data-slot="dialog-close"]','');await waitFor(`!document.querySelector('[role="dialog"]')`);
  await evaluate(`window.review.actor={id:'buyer',name:'Nguyễn Hoàng'};document.querySelector('button[aria-label="Cập nhật dự án"]').click()`);await waitFor(`document.querySelector('.fm-project-summary')?.textContent.includes('Xem đề xuất nhận được')`);
  await click('.fm-project-summary button','Xem đề xuất nhận được');await waitFor(`document.querySelectorAll('.fm-proposal').length===2`);
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await click('.fm-proposal button','Chọn cộng sự');await click('[role="dialog"] button','Chọn & bắt đầu');await waitFor(`document.querySelector('.fm-badge-working')`);
  await click('.fm-room-tabs button','Không gian làm việc');await waitFor(`document.querySelector('.fm-composer')`);await setInput('.fm-composer textarea','Chốt phương án, triển khai hồ sơ.');await click('.fm-composer button','Gửi trao đổi');await waitFor(`document.querySelector('.fm-discussion').textContent.includes('Chốt phương án')`);
  await evaluate(`window.review.actor={id:'expert',name:'Nguyễn Minh An'};document.querySelector('button[aria-label="Cập nhật dự án"]').click()`);await waitFor(`document.querySelector('.fm-upload')`);
  await evaluate(`(()=>{const input=document.querySelector('.fm-upload input[type="file"]'),transfer=new DataTransfer();transfer.items.add(new File(['%PDF-1.4'],'Ho-so-thiet-ke.pdf',{type:'application/pdf'}));input.files=transfer.files;input.form.requestSubmit();})()`);await waitFor(`document.querySelector('.fm-file-list')?.textContent.includes('Ho-so-thiet-ke.pdf')`);
  await click('.fm-workspace button','Gửi xác nhận bàn giao');await waitFor(`document.querySelector('.fm-badge-delivered')`);
  await evaluate(`window.review.actor={id:'buyer',name:'Nguyễn Hoàng'};document.querySelector('button[aria-label="Cập nhật dự án"]').click()`);await waitFor(`document.querySelector('.fm-work-actions')`);
  await click('.fm-work-actions button','Xác nhận hoàn thành');await click('[role="dialog"] button','Xác nhận hoàn thành');await waitFor(`document.querySelector('.fm-badge-completed')`);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await noOverflow();await screenshot('workspace-mobile');
  await send('Page.navigate',{url:origin+'/thue-thiet-ke?create=profile'});await waitFor(`document.querySelector('[role="dialog"] input[name="bio"]') || document.querySelector('[role="dialog"] textarea[name="bio"]')`);
  await submit({title:'Kỹ sư xây dựng',bio:'Triển khai hồ sơ kỹ thuật và kết cấu nhà ở.',skills:'Revit, AutoCAD',experience:4,rate:0,rateUnit:'project',cover:'',location:'Đà Nẵng',available:true});await waitFor(`!document.querySelector('[role="dialog"]')`);
  assert.equal(await evaluate(`window.review.profiles.find(p=>p.id==='buyer').experience`),4);
  await evaluate(`window.review.empty=true`);await setInput('.fm-search input','trống');await waitFor(`document.querySelector('.fm-empty')`);await click('.fm-empty button','Xóa bộ lọc');await waitFor(`document.querySelector('.fm-empty h3')?.textContent.includes('Cộng sự đầu tiên')`);await screenshot('empty-mobile');
  await evaluate(`window.review.fail=true`);await setInput('.fm-search input','lỗi');await waitFor(`document.querySelector('[role="alert"]')?.textContent.includes('Lỗi kiểm thử')`);await evaluate(`window.review.fail=false`);await click('.fm-empty button','Thử lại');await waitFor(`!document.querySelector('[role="alert"]')`);
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:1,mobile:true});await noOverflow();
  assert.deepEqual(exceptions,[],'No uncaught browser errors');
  console.log('PASS: real mouse clicks navigate project/profile/quote/contact links; profile creation returns to the exact project; quote update/retry/confirmation; private two-way contact before hiring and message retry; desktop/390px/320px layouts; filters; hire/upload/delivery/completion; empty/error/retry; no browser exceptions.');
  console.log('Screenshots: '+directory);
} finally { if(socket?.readyState===1)socket.send(JSON.stringify({id:999999,method:'Browser.close'}));socket?.close();chrome.kill(); }
