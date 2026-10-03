-- Update saved branding without changing resource IDs, sessions or money history.
UPDATE website_content
SET value = replace(replace(value, 'Tipook', 'NhàĐẹpChất'), 'TIPOOK', 'NhàĐẹpChất')
WHERE kind = 'text' AND (instr(value, 'Tipook') > 0 OR instr(value, 'TIPOOK') > 0);

UPDATE website_content
SET value = '/nhadepchat-symbol.png?v=4'
WHERE key = 'global.logo' AND value LIKE '/tipook-logo.png%';

UPDATE virtual_profiles
SET bio = replace(bio, 'Tipook', 'NhàĐẹpChất')
WHERE instr(bio, 'Tipook') > 0;

UPDATE website_accounts
SET display_name = 'Quản trị NhàĐẹpChất'
WHERE is_owner = 1 AND display_name = 'Quản trị Tipook';

UPDATE member_profiles
SET display_name = 'Quản trị NhàĐẹpChất'
WHERE display_name = 'Quản trị Tipook'
  AND user_id IN (SELECT user_id FROM website_accounts WHERE is_owner = 1);

UPDATE direct_messages
SET sender_name = replace(sender_name, 'Tipook', 'NhàĐẹpChất'),
    subject = replace(subject, 'Tipook', 'NhàĐẹpChất'),
    content = replace(content, 'Tipook', 'NhàĐẹpChất')
WHERE sender_user_id = 'tipook-wallet';
