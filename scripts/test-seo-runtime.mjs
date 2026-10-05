import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import jpeg from 'jpeg-js';
const origin=process.env.TIPOOK_TEST_ORIGIN||'http://127.0.0.1:8790';
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'Fixtures must stay local');
const call=async(path,body,cookie,method='POST',status=200)=>{
 const r=await fetch(origin+path,{method,headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
 assert.equal(r.status,status,await r.clone().text());return {data:await r.json(),cookie:r.headers.getSetCookie().find(v=>v.startsWith('tipook_auth_session='))?.split(';')[0]};
};
const {cookie}=await call('/api/auth/register',{username:'seo_'+crypto.randomUUID().slice(0,8),password:'seo-fixture-123456',name:'SEO Review Member'});
const {user}=await(await fetch(origin+'/api/me',{headers:{cookie}})).json();
const file=async(privateFile=false)=>{
 const form=new FormData();form.set('purpose',privateFile?'drawing-file':'drawing-preview');form.set('file',new File([privateFile?'%PDF-1.4\nSEO private fixture':readFileSync('scripts/fixtures/upload.webp')],privateFile?'private.pdf':'public.webp',{type:privateFile?'application/pdf':'image/webp'}));
 const r=await fetch(origin+'/api/files',{method:'POST',headers:{cookie},body:form});assert.equal(r.status,201,await r.clone().text());return(await r.json()).attachment;
};
const image=await file(),text='SEO visible content '+crypto.randomUUID().slice(0,8)+' </script><script>window.seoUnsafe=1</script>';
const {data:{post}}=await call('/api/posts',{category:'Bảng tin',title:'SEO public fixture',content:text,attachments:[image]},cookie,'POST',201);
const document=async(path,options={})=>{const r=await fetch(origin+path,options);return {status:r.status,headers:r.headers,html:await r.text(),url:r.url};};
const schemaOf=html=>[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(match=>JSON.parse(match[1]));
const checkShare=async(path,post,preview)=>{
 const page=await document(path,{headers:{'user-agent':'facebookexternalhit/1.1'}});
 assert.equal(page.status,200,path);
 assert.equal(new URL(page.url).pathname,'/'+post.slug,'Every legacy entry resolves to the readable permalink');
 if(path.includes('postId=') || path.startsWith('/bai-viet/')) for(const method of ['GET','HEAD']) {
  const redirect=await document(path,{method,redirect:'manual'});
  assert.equal(redirect.status,308,'Legacy links need a permanent redirect');
  assert.equal(new URL(redirect.headers.get('location'),origin).pathname,'/'+post.slug);
  assert.equal(new URL(redirect.headers.get('location'),origin).search,'');
 }
 const head=page.html.slice(page.html.indexOf('<head'),page.html.indexOf('</head>'));
 assert.ok(head.includes(`property="og:title" content="${post.title} | NhàĐẹpChất"`),'Post title must be in the initial head for social crawlers: '+path);
 assert.ok(head.includes('property="og:type" content="article"'));
 assert.ok(head.includes('property="og:image:type" content="image/jpeg"'));
 assert.ok(head.includes('property="og:image:width" content="1200"'));
 assert.ok(head.includes('property="og:image:height" content="630"'));
 assert.ok(head.includes(`property="og:url" content="https://nhadepchat.top/${post.slug}"`));
 assert.ok(head.includes(`property="og:image" content="https://nhadepchat.top/api/share-image/${post.id}.jpg?v=${preview.key}"`),'Share image must be the public uploaded image: '+path);
 assert.ok(head.includes(`name="twitter:image" content="https://nhadepchat.top/api/share-image/${post.id}.jpg?v=${preview.key}"`));
 assert.ok(page.headers.get('link')?.includes(`https://nhadepchat.top/${post.slug}`));
 assert.ok(page.html.includes(`id="post-${post.id}"`),'The shared link opens its exact post');
 const imagePath=`/api/share-image/${post.id}.jpg?v=${preview.key}`;
 const image=await fetch(origin+imagePath,{headers:{'user-agent':'facebookexternalhit/1.1'}});
 assert.equal(image.status,200,imagePath);assert.equal(image.headers.get('content-type'),'image/jpeg');
 const bytes=new Uint8Array(await image.arrayBuffer()),decoded=jpeg.decode(bytes,{useTArray:true});
 assert.equal(decoded.width,1200);assert.equal(decoded.height,630);assert.ok(bytes.length<1024*1024);
 const headImage=await fetch(origin+imagePath,{method:'HEAD'});assert.equal(headImage.status,200);assert.equal((await headImage.arrayBuffer()).byteLength,0);
 assert.equal(Number(headImage.headers.get('content-length')),bytes.length);
 assert.equal((await fetch(origin+`/api/share-image/${post.id}.jpg?v=00000000-0000-4000-8000-000000000000`)).status,404,'Stale or forged preview keys are rejected');
 return page;
};
for(const path of ['/','/gioi-thieu']){
 const {status,html,headers}=await document(path,{headers:{'user-agent':'Googlebot'}});
 assert.equal(status,200);
 const head=html.slice(html.indexOf('<head'),html.indexOf('</head>'));
 assert.ok(head.includes('rel="icon" href="/favicon.png"'),'Favicon must be discoverable without streamed metadata or JavaScript');
 assert.ok(html.includes('property="og:image" content="https://nhadepchat.top/nha-dep-chat-kien-truc.webp"'));
 const graph=schemaOf(html).flatMap(schema=>schema['@graph']||[schema]);
 assert.ok(graph.some(schema=>schema.primaryImageOfPage?.url==='https://nhadepchat.top/nha-dep-chat-kien-truc.webp'));
 assert.ok(!headers.get('x-robots-tag')?.includes('noindex'));
 if(path==='/gioi-thieu')assert.ok(graph.some(schema=>schema['@type']==='AboutPage'));
}
const staticMap=await document('/sitemaps/static.xml');
assert.ok(staticMap.html.includes('https://nhadepchat.top/gioi-thieu</loc>'));
for(const path of ['/favicon.png','/favicon.ico','/nha-dep-chat-kien-truc.webp']){
 const response=await fetch(origin+path,{headers:{'user-agent':'Googlebot-Image'}});
 assert.equal(response.status,200,path);assert.match(response.headers.get('content-type'),/^image\//);
}
let page=await document('/bai-viet/'+post.id);
await checkShare('/bai-viet/'+post.id,post,image);
assert.equal(page.status,200);
assert.ok(page.html.includes('id="post-'+post.id+'"'),'Public post is rendered before JavaScript');
assert.ok(page.html.includes('SEO visible content'),'Content is in initial HTML');
assert.ok(page.html.includes('rel="canonical" href="https://nhadepchat.top/'+post.slug+'"'));
const schema=schemaOf(page.html).find(item=>item['@type']==='SocialMediaPosting');
assert.ok(schema);assert.equal(schema.text,text);assert.ok(schema.image.some(url=>url.includes(image.key)));
assert.ok(!page.html.includes('<script>window.seoUnsafe=1</script>'),'User content cannot inject scripts');
assert.equal(page.headers.get('set-cookie'),null);
assert.match(page.headers.get('cache-control'),/no-store/);
page=await document('/bai-viet/'+post.id,{headers:{cookie,'authorization':'Bearer ignored','oai-authenticated-user-id':'forged-owner'}});
assert.equal(page.status,200);assert.equal(page.headers.get('set-cookie'),null);
assert.ok(!page.html.includes('tipook_auth_session='),'Session must not enter public HTML');
assert.equal((await document('/bai-viet/'+post.id,{method:'HEAD'})).html,'');
const profile=await document('/nguoi-dung/'+user.id,{headers:{cookie}});
assert.equal(profile.status,200);assert.ok(schemaOf(profile.html).some(item=>item['@type']==='ProfilePage'));
assert.ok(!profile.html.includes('passwordHash'));
assert.equal((await document('/bai-viet/999999999')).status,404,'Nonexistent posts must have real 404 status');
assert.equal((await document('/nguoi-dung/seo_nonexistent')).status,404);
for(const path of ['/dang-nhap','/dang-ky','/tai-khoan','/tim-kiem?q=nha','/?q=nha'])assert.match((await document(path)).headers.get('x-robots-tag')||'',/noindex/,path);
page=await document('/noi-that?page=2');assert.ok(page.html.includes('rel="canonical" href="https://nhadepchat.top/noi-that?page=2"'));
const robots=await document('/robots.txt');assert.equal(robots.status,200);assert.ok(robots.html.includes('Sitemap: https://nhadepchat.top/sitemap.xml'));assert.ok(!robots.html.includes('Disallow: /api/files'));
assert.equal((await document('/robots.txt',{method:'HEAD'})).html,'');
const sitemapHead=await document('/sitemap.xml',{method:'HEAD'});
assert.equal(sitemapHead.status,200);assert.equal(sitemapHead.html,'');
let sitemap=await document('/sitemaps/posts-1.xml');assert.ok(sitemap.html.includes('/'+post.slug+'<'));assert.ok(sitemap.html.includes(image.key));
await call('/api/my-posts',{id:post.id,imageKeys:[]},cookie,'PATCH');
assert.equal((await fetch(origin+`/api/share-image/${post.id}.jpg?v=${image.key}`)).status,404,'Removed images leave preview immediately');
sitemap=await document('/sitemaps/posts-1.xml');assert.ok(sitemap.html.includes('/'+post.slug+'<'));assert.ok(!sitemap.html.includes(image.key),'Removed images disappear on the next sitemap read');
await call('/api/my-posts',{id:post.id,action:'hide'},cookie,'PATCH');
assert.equal((await document('/bai-viet/'+post.id)).status,404,'Hidden posts must not remain in SEO HTML');
assert.ok(!(await document('/sitemaps/posts-1.xml')).html.includes('/'+post.slug+'<'));
await call('/api/my-posts',{id:post.id,action:'publish'},cookie,'PATCH');
assert.equal((await document('/bai-viet/'+post.id)).status,200);
await call('/api/my-posts',{id:post.id},cookie,'DELETE');
assert.equal((await document('/bai-viet/'+post.id)).status,404);
await call('/api/professional-profile',{accountType:'engineer'},cookie,'PUT');
const publicPreview=await file(),paidFile=await file(true);
const {data:{post:listing}}=await call('/api/posts',{category:'Bản vẽ cộng đồng',title:'SEO drawing fixture',content:'Public drawing description',priceLabel:'5000',attachments:[publicPreview],paidFiles:[paidFile]},cookie,'POST',201);
page=await document('/file-ban-ve-nha-dep-chat?postId='+listing.id);
assert.equal(page.status,200);assert.ok(page.html.includes('id="post-'+listing.id+'"'));assert.ok(!page.html.includes(paidFile.key));
assert.ok(page.html.includes('aria-label="Mua file"'));assert.ok(page.html.includes("Yêu cầu file"));
for(const path of ['/file-ban-ve-nha-dep-chat?postId=', '/kho-mau-nha-dep-chat?postId=', '/bai-viet/']) {
 const shared=await checkShare(path+listing.id,listing,publicPreview);assert.ok(!shared.html.includes(paidFile.key));
}
assert.equal((await document('/noi-that?postId='+listing.id)).status,404,'Wrong catalog links must not expose a mismatched preview');
for(const [category,path] of [['Bộ sưu tập ảnh','/kho-mau-nha-dep-chat'],['Nội thất cộng đồng','/noi-that']]) {
 const catalogPreview=await file(),catalogFile=category==='Nội thất cộng đồng'?await file(true):undefined;
 const {data:{post:catalogPost}}=await call('/api/posts',{category,title:'SEO '+category+' fixture',content:'Public catalog description',attachments:[catalogPreview],...(catalogFile?{priceLabel:'5000',paidFiles:[catalogFile]}:{})},cookie,'POST',201);
 await checkShare(path+'?postId='+catalogPost.id,catalogPost,catalogPreview);
 const shared=await checkShare('/bai-viet/'+catalogPost.id,catalogPost,catalogPreview);
 if(catalogFile) assert.ok(!shared.html.includes(catalogFile.key));
 await call('/api/my-posts',{id:catalogPost.id,action:'hide'},cookie,'PATCH');
 assert.equal((await fetch(origin+`/api/share-image/${catalogPost.id}.jpg?v=${catalogPreview.key}`)).status,404,'Hidden previews stay inaccessible after JPEG was cached');
 assert.equal((await document('/'+catalogPost.slug)).status,404);
 assert.equal((await document(path+'?postId='+catalogPost.id,{headers:{'user-agent':'facebookexternalhit/1.1',cookie}})).status,404,'Hidden posts never appear in previews, even for their owner');
 await call('/api/my-posts',{id:catalogPost.id},cookie,'DELETE');
 assert.equal((await document('/'+catalogPost.slug)).status,404);
 assert.equal((await document(path+'?postId='+catalogPost.id)).status,404);
}
for(const base of ['/kho-mau-nha-dep-chat','/file-ban-ve-nha-dep-chat','/noi-that']) {
 for(const query of ['999999999','0','abc','9007199254740992','8&postId=9'])assert.equal((await document(base+'?postId='+query)).status,404,base+'?postId='+query);
}
page=await document('/bai-viet/'+listing.id);assert.ok(!page.html.includes(paidFile.key));
sitemap=await document('/sitemaps/posts-1.xml');assert.ok(sitemap.html.includes(publicPreview.key));assert.ok(!sitemap.html.includes(paidFile.key));
assert.equal((await fetch(origin+'/api/files?key='+paidFile.key)).status,403);
assert.ok((await document('/')).html.includes('href="/'+listing.slug+'"'),'Feed exposes ordinary crawlable post links');
await call('/api/my-posts',{id:listing.id},cookie,'DELETE');
console.log('PASS: raw public HTML; Facebook/Twitter post previews and matching canonical headers on new and legacy links in all catalogs; exact post content; 404 visibility; no session/private-file leakage; robots, pagination and hide/publish/delete.');
