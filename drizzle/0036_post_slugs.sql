-- Persistent readable links, allocated at insertion and retained after title edits.
ALTER TABLE posts ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX posts_slug_unique ON posts(slug);
UPDATE posts SET slug=(
 WITH RECURSIVE letters(pos,value) AS (
   SELECT 1,'' UNION ALL SELECT pos+1,value || CASE
     WHEN substr(posts.title,pos,1) GLOB '[a-zA-Z0-9]' THEN lower(substr(posts.title,pos,1))
     WHEN instr('àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ',substr(posts.title,pos,1))>0 THEN substr('aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyydaaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd',instr('àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ',substr(posts.title,pos,1)),1)
     WHEN unicode(substr(posts.title,pos,1)) BETWEEN 768 AND 879 THEN '' ELSE '-' END
   FROM letters WHERE pos<=length(posts.title)
 ), compact(value) AS (
   SELECT value FROM letters ORDER BY pos DESC LIMIT 1
 ), squeeze(value) AS (
   SELECT value FROM compact UNION ALL SELECT replace(value,'--','-') FROM squeeze WHERE instr(value,'--')>0
 ), base(value) AS (
   SELECT coalesce(nullif(rtrim(substr(trim(value,'-'),1,160),'-'),''),'bai-viet') FROM squeeze WHERE instr(value,'--')=0
 ), candidates(n,value) AS (
   SELECT 0,value FROM base UNION ALL SELECT n+1,(SELECT value FROM base)||'-'||posts.id|| CASE WHEN n=0 THEN '' ELSE '-'||(n+1) END FROM candidates
   WHERE value IN ('api','admin','bai-viet','nguoi-dung','thue-thiet-ke','dang-nhap','dang-ky','quen-mat-khau','tai-khoan','nhat-ky-xay-nha','cam-nang','mat-bang-cong-nang','hoi-chuyen-gia','tinh-vat-tu-nha-dep-chat','gioi-thieu','privacy','tim-kiem','kho-mau-nha-dep-chat','file-ban-ve-nha-dep-chat','noi-that','bang-tin','kho-mau-nha-dep-tipook','file-ban-ve-nha-dep-tipook','tinh-vat-tu-tipook','nha-thau-thi-cong','viec-lam','quan-tri','callback','signout-with-chatgpt','signin-with-chatgpt','sitemaps','bai-viet-shell') OR EXISTS(SELECT 1 FROM posts existing WHERE existing.slug=candidates.value AND existing.id<>posts.id)
 ) SELECT value FROM candidates ORDER BY n DESC LIMIT 1
) WHERE slug IS NULL;
CREATE TRIGGER posts_assign_slug AFTER INSERT ON posts WHEN NEW.slug IS NULL
BEGIN
 UPDATE posts SET slug=(
 WITH RECURSIVE letters(pos,value) AS (
   SELECT 1,'' UNION ALL SELECT pos+1,value || CASE
     WHEN substr(NEW.title,pos,1) GLOB '[a-zA-Z0-9]' THEN lower(substr(NEW.title,pos,1))
     WHEN instr('àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ',substr(NEW.title,pos,1))>0 THEN substr('aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyydaaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd',instr('àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ',substr(NEW.title,pos,1)),1)
     WHEN unicode(substr(NEW.title,pos,1)) BETWEEN 768 AND 879 THEN '' ELSE '-' END
   FROM letters WHERE pos<=length(NEW.title)
 ), compact(value) AS (
   SELECT value FROM letters ORDER BY pos DESC LIMIT 1
 ), squeeze(value) AS (
   SELECT value FROM compact UNION ALL SELECT replace(value,'--','-') FROM squeeze WHERE instr(value,'--')>0
 ), base(value) AS (
   SELECT coalesce(nullif(rtrim(substr(trim(value,'-'),1,160),'-'),''),'bai-viet') FROM squeeze WHERE instr(value,'--')=0
 ), candidates(n,value) AS (
   SELECT 0,value FROM base UNION ALL SELECT n+1,(SELECT value FROM base)||'-'||NEW.id|| CASE WHEN n=0 THEN '' ELSE '-'||(n+1) END FROM candidates
   WHERE value IN ('api','admin','bai-viet','nguoi-dung','thue-thiet-ke','dang-nhap','dang-ky','quen-mat-khau','tai-khoan','nhat-ky-xay-nha','cam-nang','mat-bang-cong-nang','hoi-chuyen-gia','tinh-vat-tu-nha-dep-chat','gioi-thieu','privacy','tim-kiem','kho-mau-nha-dep-chat','file-ban-ve-nha-dep-chat','noi-that','bang-tin','kho-mau-nha-dep-tipook','file-ban-ve-nha-dep-tipook','tinh-vat-tu-tipook','nha-thau-thi-cong','viec-lam','quan-tri','callback','signout-with-chatgpt','signin-with-chatgpt','sitemaps','bai-viet-shell') OR EXISTS(SELECT 1 FROM posts existing WHERE existing.slug=candidates.value AND existing.id<>NEW.id)
 ) SELECT value FROM candidates ORDER BY n DESC LIMIT 1
) WHERE id=NEW.id;
END;
