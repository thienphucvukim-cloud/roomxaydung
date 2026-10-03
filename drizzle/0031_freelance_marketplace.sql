-- A fresh marketplace. No records are imported from the former design feature.
CREATE TABLE freelance_profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  title TEXT NOT NULL,
  specialty TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  skills TEXT NOT NULL DEFAULT '[]',
  experience INTEGER NOT NULL DEFAULT 0 CHECK (experience BETWEEN 0 AND 60),
  rate INTEGER NOT NULL DEFAULT 0 CHECK (rate BETWEEN 0 AND 500000000),
  rate_unit TEXT NOT NULL DEFAULT 'project' CHECK (rate_unit IN ('project', 'm2')),
  available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0,1)),
  cover TEXT NOT NULL DEFAULT '',
  portfolio TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);
CREATE INDEX freelance_profiles_specialty ON freelance_profiles(specialty, available, updated_at);
CREATE TABLE freelance_projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  freelancer_id TEXT REFERENCES freelance_profiles(user_id),
  title TEXT NOT NULL,
  specialty TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  budget INTEGER NOT NULL DEFAULT 0 CHECK (budget BETWEEN 0 AND 500000000),
  days INTEGER NOT NULL DEFAULT 0 CHECK (days BETWEEN 0 AND 365),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','working','delivered','completed','cancelled')),
  agreed_price INTEGER NOT NULL DEFAULT 0,
  agreed_days INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX freelance_projects_market ON freelance_projects(status,specialty,created_at);
CREATE INDEX freelance_projects_owner ON freelance_projects(owner_id,updated_at);
CREATE INDEX freelance_projects_freelancer ON freelance_projects(freelancer_id,updated_at);
CREATE TABLE freelance_proposals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES freelance_projects(id),
  freelancer_id TEXT NOT NULL REFERENCES freelance_profiles(user_id),
  price INTEGER NOT NULL CHECK (price BETWEEN 1 AND 500000000),
  days INTEGER NOT NULL CHECK (days BETWEEN 1 AND 365),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(project_id,freelancer_id)
);
CREATE TABLE freelance_messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES freelance_projects(id),
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX freelance_messages_project ON freelance_messages(project_id,created_at);
CREATE TABLE freelance_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES freelance_projects(id),
  uploader_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('brief','delivery')),
  object_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX freelance_files_project ON freelance_files(project_id,created_at);
