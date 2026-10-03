import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { clearLocalOwnerCooldown, finishLocalOwnerLogin } from "./test-auth-helpers.mjs";

const origin = process.env.TIPOOK_TEST_ORIGIN || "http://localhost:5173";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Functional fixtures are local only.");
const directory = `${process.env.TIPOOK_LOCAL_STATE_PATH || ".wrangler/state"}/v3/d1/miniflare-D1DatabaseObject`;
const database = readdirSync(directory).find(file => file.endsWith(".sqlite") && file !== "metadata.sqlite");
assert.ok(database, "Start the local server first.");
const db = new DatabaseSync(`${directory}/${database}`);
const userIds = [];
const marker = `__tipook_check_${crypto.randomUUID()}`;
const uploadKeys = [];
let adminCookie;

async function session() {
  const response = await fetch(origin + "/api/me");
  assert.equal(response.status, 200);
  const data = await response.json();
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  userIds.push(data.user.id);
  const send = async (route, method = "GET", body, expected = 200, extraHeaders = {}) => {
    const headers = { Cookie: cookie, ...extraHeaders };
    if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
    const response = await fetch(origin + route, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
    const result = await response.json();
    assert.ok((Array.isArray(expected) ? expected : [expected]).includes(response.status), `${method} ${route}: HTTP ${response.status} ${JSON.stringify(result)}`);
    return result;
  };
  return { cookie, userId: data.user.id, send };
}

try {
  const a = await session(), b = await session();
  assert.notEqual(a.userId, b.userId);
  await a.send("/api/actions", "POST", {actionType:"save",targetType:"house-model",targetId:marker});
  assert.equal((await a.send("/api/actions")).actions.length, 1);
  assert.equal((await b.send("/api/actions")).actions.length, 0);
  await a.send("/api/actions", "DELETE", {actionType:"save",targetType:"house-model",targetId:marker});
  assert.equal((await a.send("/api/actions")).actions.length, 0);
  console.log("PASS: private sessions and save/unsave persistence.");

  await a.send("/api/professional-profile", "PUT", {accountType:"architect"});
  assert.equal((await b.send("/api/professional-profile")).profile.accountType, "user");
  const upload = async (name, purpose, bytes, type) => {
    const body = new FormData();body.append("file",new Blob([bytes],{type}),name);body.append("purpose",purpose);
    const data = await a.send("/api/files", "POST", body, 201);
    uploadKeys.push({key:data.attachment.key,cookie:a.cookie});
    return data.attachment;
  };
  const contents = "%PDF-1.4\nNhàĐẹpChất functional fixture\n%%EOF";
  const file = await upload("fixture.pdf","drawing-file", contents, "application/pdf");
  const preview = await upload("preview.png","drawing-preview",readFileSync("public/community-house.png"),"image/png");
  const paid = (await a.send("/api/posts", "POST", {category:"Bản vẽ cộng đồng",title:marker,content:"Functional fixture",pollQuestion:"20.000đ",paidFiles:[file],attachments:[preview]},201)).post;
  await b.send("/api/posts", "POST", {category:"Bản vẽ cộng đồng",title:marker,paidFiles:[file]},403);
  await b.send("/api/professional-profile", "PUT", {accountType:"engineer"});
  await b.send("/api/posts", "POST", {category:"Bản vẽ cộng đồng",title:marker,paidFiles:[file]},400);
  const privateResponse = await fetch(origin + "/api/files?key="+file.key,{headers:{Cookie:a.cookie}});
  assert.equal(privateResponse.status,403);
  await b.send("/api/files?key="+file.key,"DELETE",undefined,403);
  assert.ok((await a.send("/api/posts?category="+encodeURIComponent("Bản vẽ cộng đồng")+"&page=1&q="+encodeURIComponent(marker))).posts.some(post=>post.id===paid.id&&!post.attachments.some(attachment=>attachment.key===file.key)));
  console.log("PASS: professional role, upload, publish, file ownership and private file protection.");

  const gallery = (await a.send("/api/posts", "POST", {category:"Bộ sưu tập ảnh",title:marker+" gallery",content:"Fixture"},201)).post;
  await a.send("/api/comments", "POST", {postId:gallery.id,content:"Fixture comment"},201);
  assert.equal((await a.send("/api/comments?postId="+gallery.id)).comments.length,1);
  await a.send("/api/model-comments", "POST", {targetId:marker,content:"Fixture model comment"},201);
  assert.equal((await a.send("/api/model-engagement?targetId="+encodeURIComponent(marker))).comments,1);
  assert.ok((await a.send("/api/search?q="+encodeURIComponent(marker))).results.some(result=>result.title===paid.title));
  assert.ok((await a.send("/api/search?q="+encodeURIComponent("Nhà phố 3 tầng xanh mát"))).results.some(result=>result.title==="Nhà phố 3 tầng xanh mát"));
  console.log("PASS: comments, counters and search across catalogs and community posts.");

  await a.send("/api/requests", "POST", {requestType:"direct-message",targetType:"profile",targetId:a.userId,recipientUserId:a.userId,subject:marker,content:"Message fixture",channels:["internal"]},201);
  const message = (await a.send("/api/messages")).messages.find(message=>message.subject===marker);
  assert.ok(message);
  assert.equal((await b.send("/api/messages")).messages.length,0);
  await a.send("/api/messages", "PATCH", {id:message.id});
  await b.send("/api/messages", "PATCH", {id:message.id},404);
  assert.ok((await a.send("/api/messages")).messages.find(m=>m.id===message.id).readAt);
  console.log("PASS: internal delivery, unread state and recipient isolation.");

  await a.send("/api/wallet/topups", "POST", {amount:9999},400);
  const topup = await a.send("/api/wallet/topups", "POST", {amount:10000},201);
  assert.equal(topup.bank.bankCode,"VCB");assert.equal(topup.bank.accountName,"TRAN VU KIM");
  assert.equal((await a.send("/api/wallet")).balance,0);
  assert.equal((await a.send("/api/wallet/topups")).requests.length,1);
  assert.equal((await b.send("/api/wallet/topups")).requests.length,0);
  await a.send("/api/admin/wallet-topups", "GET", undefined,401,{"oai-authenticated-user-id":"spoof","oai-authenticated-user-email":"tranvukim.xd@gmail.com"});
  await a.send("/api/wallet/purchase", "POST", {targetType:"post",targetId:String(paid.id),purchaseId:crypto.randomUUID()},402);
  console.log("PASS: topup QR, pending approval, insufficient balance and admin header spoof rejection.");

  // Authenticate the website owner with the local configured credentials.
  const funded = await b.send("/api/wallet/topups", "POST", {amount:100000},201);
  const localVars = readFileSync(".dev.vars", "utf8");
  const setting = key => localVars.match(new RegExp(`^${key}[ \\t]*=[ \\t]*["']?([^\\s"']+)`, "m"))?.[1];
  const localOwner = db.prepare("SELECT user_id FROM website_accounts WHERE email = ?").get(setting("TIPOOK_ADMIN_EMAIL"));
  if (localOwner) clearLocalOwnerCooldown(db, localOwner.user_id);
  const ownerLogin = await fetch(origin + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: setting("TIPOOK_ADMIN_EMAIL"), password: setting("TIPOOK_ADMIN_PASSWORD") }) });
  assert.equal(ownerLogin.status, 200, "Configure the local owner with scripts/setup-owner.mjs.");
  adminCookie = (await finishLocalOwnerLogin(origin, db, ownerLogin)).cookie;
  assert.ok(adminCookie);
  const adminMe = await (await fetch(origin + "/api/me", { headers: { Cookie: adminCookie } })).json();
  assert.ok(adminMe.user.isAdmin, "Configure TIPOOK_ADMIN_EMAIL in .dev.vars for the local admin.");
  const admin = async (method, body, status=200) => {
    const response = await fetch(origin + "/api/admin/wallet-topups", {method, headers:{Cookie:adminCookie,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
    const result = await response.json();assert.equal(response.status,status,JSON.stringify(result));return result;
  };
  const pending = (await admin("GET")).requests.find(item=>item.requestCode===funded.request.requestCode);
  assert.ok(pending);
  await admin("PATCH", {id:pending.id,status:"approved"});
  await admin("PATCH", {id:pending.id,status:"approved"},409);
  assert.equal((await b.send("/api/wallet")).balance,100000);
  const rejected = (await admin("GET")).requests.find(item=>item.requestCode===topup.request.requestCode);
  await admin("PATCH", {id:rejected.id,status:"rejected"});
  await admin("PATCH", {id:rejected.id,status:"approved"},409);
  assert.equal((await a.send("/api/wallet")).balance,0);
  console.log("PASS: admin approval and rejection cannot credit a request twice.");
  const manage = async (resource, body, expected=200) => {
    const response = await fetch(origin + "/api/admin/manage/" + resource, {method:"PATCH", headers:{Cookie:adminCookie,"Content-Type":"application/json"},body:JSON.stringify(body)});
    const result = await response.json(); assert.equal(response.status,expected,JSON.stringify(result)); return result;
  };
  await a.send("/api/admin/manage/posts", "PATCH", {id:gallery.id,title:marker+" edited",content:"Edited fixture"},401);
  await manage("posts", {id:gallery.id,title:marker+" edited",content:"Edited fixture"});
  assert.equal(db.prepare("SELECT title FROM posts WHERE id=?").get(gallery.id).title,marker+" edited");
  await manage("posts", {id:paid.id,audience:"Ẩn bởi quản trị"});
  assert.ok(!(await a.send("/api/posts?category="+encodeURIComponent("Bản vẽ cộng đồng")+"&page=1&q="+encodeURIComponent(marker))).posts.some(post=>post.id===paid.id));
  await b.send("/api/wallet/purchase", "POST", {targetType:"post",targetId:String(paid.id),purchaseId:crypto.randomUUID()},404);
  await manage("posts", {id:paid.id,audience:"Công khai"});
  db.prepare("UPDATE posts SET audience='Riêng tư' WHERE id=?").run(gallery.id);
  await manage("posts", {id:gallery.id,audience:"Công khai"},404);
  db.prepare("UPDATE posts SET audience='Công khai' WHERE id=?").run(gallery.id);
  const inquiry=(await b.send("/api/requests", "POST", {requestType:"design-consultation",targetType:"catalog",targetId:marker,recipientUserId:adminMe.user.id,subject:marker,content:"Owner inquiry fixture",channels:["internal"]},201)).request;
  await manage("requests", {id:inquiry.id,status:"processing"});
  assert.equal((await b.send("/api/requests")).requests.find(item=>item.id===inquiry.id).status,"processing");
  const privateRequest=(await a.send("/api/requests")).requests[0];
  await manage("requests", {id:privateRequest.id,status:"completed"},404);
  console.log("PASS: inline owner management, post visibility, hidden listing checkout rejection and private-request isolation.");
  await Promise.all(Array.from({length:6},()=>b.send("/api/wallet/purchase", "POST", {targetType:"post",targetId:String(paid.id),purchaseId:crypto.randomUUID()},[200,201])));
  assert.equal((await b.send("/api/wallet")).balance,80000);
  assert.equal(db.prepare("SELECT count(*) AS n FROM wallet_transactions WHERE user_id=? AND kind='purchase'").get(b.userId).n,1);
  const order = await b.send("/api/wallet/purchase", "POST", {targetType:"post",targetId:String(paid.id),purchaseId:crypto.randomUUID()});
  assert.equal(order.downloadLinks.length,1);
  const download = await fetch(order.downloadLinks[0].url,{headers:{Cookie:b.cookie}});
  assert.equal(download.status,200);assert.equal(await download.text(),contents);
  const other = await fetch(order.downloadLinks[0].url,{headers:{Cookie:a.cookie}});
  assert.equal(other.status,403);
  const expired = new URL(order.downloadLinks[0].url);expired.searchParams.set("expires","1");
  assert.equal((await fetch(expired,{headers:{Cookie:b.cookie}})).status,410);
  console.log("PASS: concurrent checkout charges once; download content, buyer binding and expiry.");

  const freeFile=await upload("free.pdf","drawing-file",contents,"application/pdf");
  const free=(await a.send("/api/posts", "POST", {category:"Nội thất cộng đồng",title:marker+" free",paidFiles:[freeFile]},201)).post;
  const freeOrder=await a.send("/api/wallet/purchase", "POST", {targetType:"post",targetId:String(free.id),purchaseId:crypto.randomUUID()},201);
  assert.equal(freeOrder.downloadLinks.length,1);assert.equal((await a.send("/api/wallet")).balance,0);
  console.log("PASS: free file checkout without topup.");

  const content = async (method = "GET", body, expected = 200, suffix = "", extra = {}) => {
    const response = await fetch(origin + "/api/admin/manage/posts" + suffix, { method, headers: { Cookie: adminCookie, "Content-Type": "application/json", ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = response.headers.get("content-type")?.includes("application/json") ? await response.json() : await response.text();
    assert.equal(response.status, expected, JSON.stringify(data)); return data;
  };
  await a.send("/api/admin/manage/posts", "DELETE", { id: paid.id }, 401);
  await content("DELETE", { id: paid.id }, 403, "", { Origin: "https://untrusted.example" });
  await content("DELETE", { id: paid.id }, 403, "", { "Sec-Fetch-Site": "cross-site" });
  for (const id of [0, -1, 1.5, "1"]) await content("DELETE", { id }, 400);
  await content("DELETE", null, 400);
  await content("GET", undefined, 400, "?filter=invalid");
  db.prepare("UPDATE posts SET audience='Riêng tư' WHERE id=?").run(gallery.id);
  await content("DELETE", { id: gallery.id }, 404);
  db.prepare("UPDATE posts SET audience='Công khai' WHERE id=?").run(gallery.id);
  const filesBeforeDelete = db.prepare("SELECT count(*) AS n FROM post_attachments WHERE post_id=?").get(paid.id).n;
  await content("DELETE", { id: paid.id });
  await content("DELETE", { id: paid.id }, 404);
  assert.equal(db.prepare("SELECT audience FROM posts WHERE id=?").get(paid.id).audience, "Đã xóa bởi quản trị");
  assert.ok(!(await content("GET", undefined, 200, "?id=" + paid.id)).items.length);
  assert.ok((await content("GET", undefined, 200, "?filter=deleted&id=" + paid.id)).items.some(post => post.id === paid.id));
  assert.ok(!(await a.send("/api/posts?category=" + encodeURIComponent("Bản vẽ cộng đồng") + "&page=1&q=" + encodeURIComponent(marker))).posts.some(post => post.id === paid.id));
  assert.ok(!(await a.send("/api/search?q=" + encodeURIComponent(marker))).results.some(result => result.title === paid.title));
  await manage("posts", { id: paid.id, audience: "Công khai" }, 404);
  await a.send("/api/wallet/purchase", "POST", { targetType: "post", targetId: String(paid.id), purchaseId: crypto.randomUUID() }, 404);
  assert.equal(db.prepare("SELECT count(*) AS n FROM post_attachments WHERE post_id=?").get(paid.id).n, filesBeforeDelete);
  const renewed = await b.send("/api/wallet/purchase", "POST", { targetType: "post", targetId: String(paid.id), purchaseId: crypto.randomUUID() });
  assert.equal(renewed.alreadyPurchased, true); assert.equal((await b.send("/api/wallet")).balance, 80000);
  const deletedDownload = await fetch(renewed.downloadLinks[0].url, { headers: { Cookie: b.cookie } });
  assert.equal(deletedDownload.status, 200); assert.equal(await deletedDownload.text(), contents);
  await manage("posts", { id: paid.id, action: "restore" });
  await manage("posts", { id: paid.id, action: "restore" }, 404);
  assert.equal(db.prepare("SELECT audience FROM posts WHERE id=?").get(paid.id).audience, "Ẩn bởi quản trị");
  assert.ok(!(await content("GET", undefined, 200, "?filter=deleted&id=" + paid.id)).items.length);
  await manage("posts", { id: paid.id, audience: "Công khai" });
  assert.ok((await a.send("/api/posts?category=" + encodeURIComponent("Bản vẽ cộng đồng") + "&page=1&q=" + encodeURIComponent(marker))).posts.some(post => post.id === paid.id));
  console.log("PASS: admin trash, validation, CSRF, private-post protection, restore, public search removal and paid download renewal without charging again.");
  console.log("All functional flows passed.");
} finally {
  if (adminCookie) await fetch(origin + "/api/auth/logout", { method: "POST", headers: { Cookie: adminCookie }, redirect: "manual" });
  for(const userId of userIds) {
    db.prepare("DELETE FROM direct_messages WHERE sender_user_id=? OR recipient_user_id=?").run(userId,userId);
    db.prepare("DELETE FROM post_comments WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM post_attachments WHERE post_id IN (SELECT id FROM posts WHERE user_id=?)").run(userId);
    db.prepare("DELETE FROM posts WHERE user_id=?").run(userId);
    for(const table of ["user_actions","user_requests","member_profiles","delivery_profiles","wallet_topup_requests","wallet_transactions"]){db.prepare(`DELETE FROM ${table} WHERE user_id=?`).run(userId);}
  }
  db.close();
  for(const file of uploadKeys) {
    const response = await fetch(origin + "/api/files?key=" + file.key, {method:"DELETE",headers:{Cookie:file.cookie}});
    assert.equal(response.status,200,"Fixture upload cleanup failed.");
  }
}
