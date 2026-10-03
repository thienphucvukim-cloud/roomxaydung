// Isolated SQLite/R2 integration fixtures; never touches the site's database.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import ts from 'typescript';

const sqlite = new DatabaseSync(':memory:');
for (const file of readdirSync('drizzle').filter(file => file.endsWith('.sql')).sort()) sqlite.exec(readFileSync('drizzle/' + file,'utf8'));
let identity = null, beforeRun = null;
const db = { prepare(sql) { let args = []; const statement = {
  bind(...values) { args = values; return statement; },
  async first() { return sqlite.prepare(sql).get(...args) || null; },
  async all() { return { results: sqlite.prepare(sql).all(...args) }; },
  async run() { if (beforeRun) { const fn = beforeRun; beforeRun = null; fn(sql); } return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; },
}; return statement; } };
const objects = new Map();
const bucket = { async put(key,data) { objects.set(key,data); }, async delete(key) { objects.delete(key); }, async get(key) { return objects.has(key) ? { body: objects.get(key) } : null; } };
const buyer = { userId:'buyer',displayName:'Gia chủ' }, expert = { userId:'expert',displayName:'KTS. An' }, other = { userId:'other',displayName:'KS. Bình' }, stranger = { userId:'stranger',displayName:'Người xem' };
for (const actor of [buyer,expert,other,stranger]) sqlite.prepare("INSERT INTO member_profiles(user_id,display_name,account_type,updated_at) VALUES(?,?,'user',?)").run(actor.userId,actor.displayName,new Date().toISOString());
const context = createContext({ Request,Response,Headers,FormData,File,URL,URLSearchParams,crypto,console });
const cache = new Map();
const stubs = { 'cloudflare:workers': { env: { DB:db,BUCKET:bucket } }, '@/lib/website-auth': { getAuthenticatedIdentity: async () => identity, validOrigin: request => request.headers.get('origin') === new URL(request.url).origin } };
async function load(name,parent) {
  const file = name.startsWith('@/') ? name.slice(2) : name.startsWith('.') ? new URL(name + (name.endsWith('.ts') ? '' : '.ts'),'file:///' + parent.identifier).pathname.slice(1).replace(/\.ts$/,'') : name;
  if (cache.has(file)) return cache.get(file);
  let vmModule;
  if (stubs[name]) { const values = stubs[name]; vmModule = new SyntheticModule(Object.keys(values),function(){ for (const [key,value] of Object.entries(values)) this.setExport(key,value); },{context}); }
  else { const location = file.endsWith('.ts') ? file : file + '.ts'; vmModule = new SourceTextModule(ts.transpileModule(readFileSync(location,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,{context,identifier:location}); }
  cache.set(file,vmModule); return vmModule;
}
async function api(file) { const vmModule = await load('@/app/api/freelance/' + file); await vmModule.link(load); await vmModule.evaluate(); return vmModule.namespace; }
const listing = await api('route'), profiles = await api('profiles/route'), projects = await api('projects/route'), files = await api('files/route');
async function post(api,actor,body,status=200,origin='http://local.test') {
  identity = actor;
  const response = await api.POST(new Request('http://local.test/api/freelance',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
  const result = await response.json(); assert.equal(response.status,status,JSON.stringify(result)); return result;
}
async function get(api,actor,query='',status=200) { identity = actor; const response = await api.GET(new Request('http://local.test/api/freelance?' + query)); assert.equal(response.status,status,await response.clone().text()); return response.json(); }
async function upload(actor,projectId,purpose,status=200,name='drawing.pdf') { identity=actor;const form=new FormData();form.set('projectId',projectId);form.set('purpose',purpose);form.set('file',new File(['%PDF-1.4 fixture'],name));const response=await files.POST(new Request('http://local.test/api/freelance/files',{method:'POST',headers:{origin:'http://local.test'},body:form}));const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result; }
const profileBody = { title:'Kiến trúc sư nhà ở',specialty:'Thiết kế kiến trúc',bio:'Thiết kế nhà phố và hồ sơ xây dựng.',location:'TP. Hồ Chí Minh',skills:'AutoCAD, SketchUp, AutoCAD',experience:7,rate:180000,rateUnit:'m2',available:true,cover:'',portfolio:[{title:'Nhà phố An Phú',url:'https://example.com/portfolio'}] };
await post(profiles,null,profileBody,401);
await post(profiles,expert,profileBody,403,'https://cross-site.test');
await post(profiles,expert,{...profileBody,cover:'javascript:alert(1)'},400);
await post(profiles,expert,{...profileBody,experience:-1},400);
await post(profiles,expert,{...profileBody,portfolio:[{title:'bad',url:'http://example.com'}]},400);
await post(profiles,expert,profileBody);
await post(profiles,other,{...profileBody,title:'Kỹ sư kết cấu',specialty:'Thiết kế kết cấu',experience:12,rate:200000,available:false,portfolio:[]});
assert.equal((await get(profiles,null,'id=expert')).profile.skills.length,2);
assert.equal((await get(listing,null)).total,2);
assert.equal((await get(listing,null,'specialty=' + encodeURIComponent('Thiết kế kết cấu'))).profiles[0].id,'other');
assert.equal((await get(listing,null,'q=SketchUp')).total,2);
assert.equal((await get(listing,null,'available=1')).total,1);
assert.equal((await get(listing,null,'sort=experience')).profiles[0].id,'other');
assert.equal((await get(listing,null,'sort=rate')).profiles[0].id,'expert');
await get(listing,null,'view=mine',401);
await get(listing,null,'specialty=invalid',400);
await get(listing,null,'sort=invalid',400);
await get(profiles,null,'id=missing',404);
sqlite.prepare("UPDATE member_profiles SET account_status='disabled' WHERE user_id='other'").run();
assert.equal((await get(listing,null)).total,1);
await get(profiles,null,'id=other',404);
sqlite.prepare("UPDATE member_profiles SET account_status='active' WHERE user_id='other'").run();

const creation = { action:'create',requestId:crypto.randomUUID(),title:'Thiết kế nhà phố 5 × 20m',specialty:'Thiết kế kiến trúc',description:'Nhà ba tầng, ưu tiên ánh sáng tự nhiên.',location:'Thủ Đức',budget:15000000,days:21 };
await post(projects,null,creation,401);
await post(projects,buyer,creation,403,'https://cross-site.test');
await post(projects,buyer,{...creation,budget:-1},400);
await post(projects,buyer,{...creation,days:1.5},400);
const {project:p} = await post(projects,buyer,creation), id = p.id;
await post(projects,buyer,creation);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM freelance_projects').get().n,1);
await post(projects,other,creation,409);
const act = (actor,action,fields={},status=200) => post(projects,actor,{id,action,...fields},status);
await act(buyer,'propose',{requestId:crypto.randomUUID(),price:12000000,days:20,content:'Tự báo giá'},409);
await act(stranger,'propose',{requestId:crypto.randomUUID(),price:12000000,days:20,content:'Chưa có hồ sơ'},403);
const firstProposal = crypto.randomUUID();
await act(expert,'propose',{requestId:firstProposal,price:12000000,days:20,content:'Thiết kế kiến trúc, bàn giao PDF + DWG, hai lần chỉnh sửa.'});
await act(expert,'propose',{requestId:crypto.randomUUID(),price:11000000,days:18,content:'Cập nhật phạm vi: PDF + DWG, phối cảnh JPG.'});
await act(other,'propose',{requestId:crypto.randomUUID(),price:16000000,days:25,content:'Phương án kiến trúc và kết cấu.'});
assert.equal((await get(projects,buyer,'id='+id)).proposals.length,2);
assert.equal((await get(projects,expert,'id='+id)).proposals.length,1);
assert.equal((await get(projects,expert,'id='+id)).proposals[0].price,11000000);
assert.equal((await get(projects,null,'id='+id)).proposals.length,0);
assert.equal((await get(listing,expert,'view=mine')).total,1);
assert.equal((await get(listing,null,'view=projects&budget=5-20')).total,1);
assert.equal((await get(listing,null,'view=projects&budget=under-5')).total,0);
await act(other,'hire',{proposalId:firstProposal},403);
const brief = await upload(buyer,id,'brief');
await upload(other,id,'brief',403);
await upload(buyer,id,'brief',400,'danger.exe');
identity=null; assert.equal((await files.GET(new Request('http://local.test/api/freelance/files?id='+brief.id))).status,401);
await act(buyer,'hire',{proposalId:firstProposal});
await act(buyer,'hire',{proposalId:firstProposal},409);
await act(other,'propose',{requestId:crypto.randomUUID(),price:5000000,days:14,content:'Quá muộn'},409);
assert.equal((await get(listing,null,'view=projects')).total,0);
await act(expert,'deliver',{},400);
await act(buyer,'deliver',{},403);
await act(stranger,'message',{requestId:crypto.randomUUID(),content:'Xâm nhập'},403);
const msg = {requestId:crypto.randomUUID(),content:'Chốt phương án, triển khai hồ sơ.'};
await act(buyer,'message',msg); await act(buyer,'message',msg);
assert.equal((await get(projects,buyer,'id='+id)).messages.length,1);
assert.equal((await get(projects,other,'id='+id)).messages.length,0);
assert.equal((await get(projects,other,'id='+id)).project.agreedPrice,0);
assert.equal((await get(projects,null,'id='+id)).project.freelancerId,null);
await upload(buyer,id,'delivery',403);
const delivery = await upload(expert,id,'delivery');
identity=other; assert.equal((await files.GET(new Request('http://local.test/api/freelance/files?id='+delivery.id))).status,403);
identity=buyer; const download=await files.GET(new Request('http://local.test/api/freelance/files?id='+delivery.id));assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/^attachment/);
await act(expert,'deliver'); await act(expert,'complete',{},403); await act(buyer,'revise'); await act(expert,'deliver'); await act(buyer,'complete');
assert.equal((await get(profiles,null,'id=expert')).profile.completedCount,1);
assert.equal((await get(projects,buyer,'id='+id)).project.status,'completed');
await act(buyer,'message',{requestId:crypto.randomUUID(),content:'Đã hoàn thành'},403);
await upload(expert,id,'delivery',403);

// Simulate the project closing between reading it and writing a proposal.
const raceId=(await post(projects,buyer,{...creation,requestId:crypto.randomUUID()})).project.id;
beforeRun = sql => { assert.match(sql,/INSERT INTO freelance_proposals/);sqlite.prepare("UPDATE freelance_projects SET status='cancelled' WHERE id=?").run(raceId); };
await post(projects,expert,{id:raceId,action:'propose',requestId:crypto.randomUUID(),price:1000000,days:10,content:'Race check'},409);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM freelance_proposals WHERE project_id=?').get(raceId).n,0);
const uploadRace=(await post(projects,buyer,{...creation,requestId:crypto.randomUUID()})).project.id;
const objectsBefore=objects.size;
beforeRun=sql=>{assert.match(sql,/INSERT INTO freelance_files/);sqlite.prepare("UPDATE freelance_projects SET status='cancelled' WHERE id=?").run(uploadRace);};
await upload(buyer,uploadRace,'brief',409);assert.equal(objects.size,objectsBefore,'Failed uploads must be removed from R2');

console.log('PASS: fresh profiles; validation/auth/origin; real filters/sorting; project creation replay; proposal privacy/update; atomic hiring; private messages; protected files; revise/deliver/complete; write races; failed-upload cleanup.');
sqlite.close();
