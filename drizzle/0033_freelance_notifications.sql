-- Keep marketplace events in the existing private inbox. Triggers commit
-- together with each successful write and do not backfill old projects.
CREATE TRIGGER freelance_proposal_notify_insert
AFTER INSERT ON freelance_proposals
BEGIN
  INSERT INTO direct_messages(sender_user_id,sender_name,recipient_user_id,subject,content,created_at)
  SELECT NEW.freelancer_id,f.display_name,p.owner_id,'Báo giá thiết kế: ' || p.title,
    'Đã gửi báo giá ' || NEW.price || 'đ, thời gian ' || NEW.days || ' ngày.' || char(10) || NEW.content || char(10) || '/thue-thiet-ke/' || p.id || '?action=proposals',NEW.created_at
  FROM freelance_projects p JOIN freelance_profiles f ON f.user_id=NEW.freelancer_id WHERE p.id=NEW.project_id;
END;

CREATE TRIGGER freelance_proposal_notify_update
AFTER UPDATE OF price,days,content ON freelance_proposals
WHEN OLD.price <> NEW.price OR OLD.days <> NEW.days OR OLD.content <> NEW.content
BEGIN
  INSERT INTO direct_messages(sender_user_id,sender_name,recipient_user_id,subject,content,created_at)
  SELECT NEW.freelancer_id,f.display_name,p.owner_id,'Cập nhật báo giá: ' || p.title,
    'Báo giá mới: ' || NEW.price || 'đ, thời gian ' || NEW.days || ' ngày.' || char(10) || NEW.content || char(10) || '/thue-thiet-ke/' || p.id || '?action=proposals',strftime('%Y-%m-%dT%H:%M:%fZ','now')
  FROM freelance_projects p JOIN freelance_profiles f ON f.user_id=NEW.freelancer_id WHERE p.id=NEW.project_id;
END;

CREATE TRIGGER freelance_project_notify_status
AFTER UPDATE OF status ON freelance_projects
WHEN OLD.status <> NEW.status AND NEW.freelancer_id IS NOT NULL AND NEW.status <> 'cancelled'
BEGIN
  INSERT INTO direct_messages(sender_user_id,sender_name,recipient_user_id,subject,content,created_at)
  SELECT CASE WHEN NEW.status='delivered' THEN NEW.freelancer_id ELSE NEW.owner_id END,
    CASE WHEN NEW.status='delivered' THEN f.display_name ELSE NEW.owner_name END,
    CASE WHEN NEW.status='delivered' THEN NEW.owner_id ELSE NEW.freelancer_id END,
    CASE WHEN NEW.status='working' AND OLD.status='open' THEN 'Bạn được chọn nhận việc: '
      WHEN NEW.status='delivered' THEN 'Hồ sơ chờ nghiệm thu: '
      WHEN NEW.status='completed' THEN 'Dự án đã hoàn thành: '
      ELSE 'Yêu cầu điều chỉnh: ' END || NEW.title,
    CASE WHEN NEW.status='working' AND OLD.status='open' THEN 'Bên thuê đã chọn bạn với giá ' || NEW.agreed_price || 'đ trong ' || NEW.agreed_days || ' ngày. Mở dự án để bắt đầu trao đổi.'
      WHEN NEW.status='delivered' THEN 'Freelancer đã gửi hồ sơ bàn giao. Mở dự án để kiểm tra và xác nhận.'
      WHEN NEW.status='completed' THEN 'Bên thuê đã xác nhận hoàn thành hồ sơ.'
      ELSE 'Bên thuê yêu cầu điều chỉnh hồ sơ. Mở không gian làm việc để trao đổi.' END || char(10) || '/thue-thiet-ke/' || NEW.id,
    NEW.updated_at
  FROM freelance_profiles f WHERE f.user_id=NEW.freelancer_id;
END;

CREATE TRIGGER freelance_message_notify
AFTER INSERT ON freelance_messages
BEGIN
  INSERT INTO direct_messages(sender_user_id,sender_name,recipient_user_id,subject,content,created_at)
  SELECT NEW.author_id,NEW.author_name,
    CASE WHEN NEW.author_id=p.owner_id THEN p.freelancer_id ELSE p.owner_id END,
    'Trao đổi dự án: ' || p.title,NEW.content || char(10) || '/thue-thiet-ke/' || p.id,NEW.created_at
  FROM freelance_projects p WHERE p.id=NEW.project_id AND p.freelancer_id IS NOT NULL
    AND NEW.author_id IN (p.owner_id,p.freelancer_id);
END;
