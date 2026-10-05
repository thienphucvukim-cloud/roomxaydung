import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
import { titleSlug,isPostSlug,postHref,RESERVED_POST_SLUGS } from '../lib/post-url.ts';
const db=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')&&f<'0036').sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
const insert=db.prepare("INSERT INTO posts(user_id,author_name,category,title,content,created_at) VALUES('author','Author','Bảng tin',?,'Text','2026-10-05')");
const existing=['Nhà phố 2 tầng','Nhà phố 2 tầng','Nội thất','Đẹp 5×20m','NHÀ cấp 4 mái nhật 10x14m','Đặng thức','😀'];
const old=existing.map(title=>({id:Number(insert.run(title).lastInsertRowid),title}));
db.exec(readFileSync('drizzle/0036_post_slugs.sql','utf8'));
const get=id=>db.prepare('SELECT id,title,slug FROM posts WHERE id=?').get(id);
assert.equal(get(old[0].id).slug,'nha-pho-2-tang');
assert.equal(get(old[1].id).slug,'nha-pho-2-tang-2');
assert.equal(get(old[4].id).slug,'nha-cap-4-mai-nhat-10x14m');
for(const row of old){assert.ok(isPostSlug(get(row.id).slug));if(!RESERVED_POST_SLUGS.has(titleSlug(row.title))&&row.id!==old[1].id)assert.equal(get(row.id).slug,titleSlug(row.title));}
for(const title of ['Nhà phố 2 tầng',...RESERVED_POST_SLUGS,'A'.repeat(180),'---','123','Không gian mở — ấm áp & gần gũi']) {
 const id=Number(insert.run(title).lastInsertRowid),post=get(id);
 assert.ok(isPostSlug(post.slug),post.slug); assert.ok(!RESERVED_POST_SLUGS.has(post.slug));
 const slug=post.slug;
 db.prepare('UPDATE posts SET title=? WHERE id=?').run('Đổi tên sau khi chia sẻ',id);
 assert.equal(get(id).slug,slug,'Title edits must preserve published links');
 assert.equal(postHref(post),'/'+slug);
}
const collision=Number(insert.run('Nhà phố 2 tầng-2').lastInsertRowid);
assert.notEqual(get(collision).slug,'nha-pho-2-tang-2');
assert.equal(db.prepare('SELECT count(*) AS n FROM posts').get().n,db.prepare('SELECT count(DISTINCT slug) AS n FROM posts').get().n);
console.log('PASS: existing and new titles get stable unique readable URLs; Vietnamese accents, reserved routes, duplicates, numeric/empty/long titles, collisions and title edits.');
