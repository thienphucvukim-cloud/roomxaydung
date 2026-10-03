CREATE TABLE design_projects (
  id TEXT PRIMARY KEY,
  employer_id TEXT NOT NULL,
  expert_id TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  version INTEGER NOT NULL DEFAULT 1,
  total INTEGER NOT NULL DEFAULT 0 CHECK(total >= 0),
  funded INTEGER NOT NULL DEFAULT 0 CHECK(funded >= 0 AND funded <= total),
  earnings INTEGER NOT NULL DEFAULT 0 CHECK(earnings >= 0),
  released_at TEXT,
  operation_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_design_projects_employer ON design_projects(employer_id, updated_at);
CREATE INDEX idx_design_projects_expert ON design_projects(expert_id, released_at);
CREATE INDEX idx_design_projects_status ON design_projects(status, updated_at);
CREATE TABLE design_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES design_projects(id),
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_design_events_project ON design_events(project_id, created_at);
CREATE TABLE design_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES design_projects(id),
  uploader_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('brief', 'delivery')),
  object_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_design_files_project ON design_files(project_id, purpose);
CREATE TRIGGER design_events_no_update BEFORE UPDATE ON design_events BEGIN SELECT RAISE(ABORT, 'Project history is immutable'); END;
CREATE TRIGGER design_events_no_delete BEFORE DELETE ON design_events BEGIN SELECT RAISE(ABORT, 'Project history is immutable'); END;
CREATE TRIGGER design_projects_no_delete BEFORE DELETE ON design_projects BEGIN SELECT RAISE(ABORT, 'Project records cannot be deleted'); END;
CREATE TRIGGER design_projects_audit_insert AFTER INSERT ON design_projects BEGIN
  INSERT INTO finance_audit_events(table_name, record_key, operation, new_payload) VALUES ('design_projects', NEW.id, 'insert', json_object('status', NEW.status, 'total', NEW.total, 'funded', NEW.funded, 'earnings', NEW.earnings, 'released_at', NEW.released_at, 'payload', NEW.payload));
END;
CREATE TRIGGER design_projects_audit_update AFTER UPDATE ON design_projects BEGIN
  INSERT INTO finance_audit_events(table_name, record_key, operation, old_payload, new_payload) VALUES ('design_projects', NEW.id, 'update', json_object('status', OLD.status, 'funded', OLD.funded, 'earnings', OLD.earnings, 'payload', OLD.payload), json_object('status', NEW.status, 'total', NEW.total, 'funded', NEW.funded, 'earnings', NEW.earnings, 'released_at', NEW.released_at, 'payload', NEW.payload));
END;
