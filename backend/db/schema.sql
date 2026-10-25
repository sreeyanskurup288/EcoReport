CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE report_severity AS ENUM ('Low', 'Medium', 'High');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('Pending', 'In Progress', 'Resolved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE SEQUENCE IF NOT EXISTS report_number_seq START WITH 1043;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_code TEXT NOT NULL UNIQUE DEFAULT ('ER-' || nextval('report_number_seq')::TEXT),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type VARCHAR(30) NOT NULL CHECK (type IN ('Waste', 'Water', 'Air', 'Noise', 'Trees', 'Drainage', 'Other')),
  description VARCHAR(1000) NOT NULL,
  location VARCHAR(180) NOT NULL,
  gmaps_url TEXT,
  latitude DOUBLE PRECISION CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  severity report_severity NOT NULL DEFAULT 'Medium',
  status report_status NOT NULL DEFAULT 'Pending',
  photo_url TEXT,
  observed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);

ALTER TABLE reports ADD COLUMN IF NOT EXISTS gmaps_url TEXT;

CREATE TABLE IF NOT EXISTS report_status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  old_status report_status,
  new_status report_status NOT NULL,
  note VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reports_status_created_idx ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_type_created_idx ON reports(type, created_at DESC);
CREATE INDEX IF NOT EXISTS report_updates_report_created_idx ON report_status_updates(report_id, created_at);
