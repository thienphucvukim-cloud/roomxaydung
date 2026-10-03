ALTER TABLE design_files ADD COLUMN channel TEXT NOT NULL DEFAULT 'contract';
ALTER TABLE design_files ADD COLUMN recipient_id TEXT;
ALTER TABLE design_files ADD COLUMN dispute_id TEXT;
CREATE TABLE design_communications (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES design_projects(id),
  channel TEXT NOT NULL CHECK(channel IN ('comment','private','evidence')),
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  recipient_id TEXT,
  content TEXT NOT NULL,
  file_id TEXT REFERENCES design_files(id),
  dispute_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_design_communications_project ON design_communications(project_id,channel,created_at);
CREATE INDEX idx_design_communications_private ON design_communications(project_id,sender_id,recipient_id,created_at);
CREATE TABLE design_contract_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES design_projects(id),
  revision INTEGER NOT NULL,
  hash TEXT NOT NULL,
  payload TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_design_contract_snapshots_project ON design_contract_snapshots(project_id,created_at);
CREATE TRIGGER design_contract_snapshots_no_update BEFORE UPDATE ON design_contract_snapshots BEGIN SELECT RAISE(ABORT,'Contract snapshots are immutable'); END;
CREATE TRIGGER design_contract_snapshots_no_delete BEFORE DELETE ON design_contract_snapshots BEGIN SELECT RAISE(ABORT,'Contract snapshots are immutable'); END;
CREATE TRIGGER design_communications_no_update BEFORE UPDATE ON design_communications BEGIN SELECT RAISE(ABORT,'Project evidence is immutable'); END;
CREATE TRIGGER design_communications_no_delete BEFORE DELETE ON design_communications BEGIN SELECT RAISE(ABORT,'Project evidence is immutable'); END;
CREATE TRIGGER design_contract_snapshots_audit AFTER INSERT ON design_contract_snapshots BEGIN
  INSERT INTO finance_audit_events(table_name,record_key,operation,new_payload) VALUES('design_contract_snapshots',NEW.id,'insert',json_object('project_id',NEW.project_id,'hash',NEW.hash,'payload',NEW.payload,'actor_id',NEW.actor_id));
END;
