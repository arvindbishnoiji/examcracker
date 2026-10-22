-- Additive achievement system. Badge images are URL references for now; binaries
-- remain outside D1. Manual award history is retained on revocation.
CREATE TABLE IF NOT EXISTS badge_definitions (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 2 AND 80),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 280),
  criteria TEXT NOT NULL DEFAULT '' CHECK (length(criteria) <= 1000),
  category TEXT NOT NULL DEFAULT 'achievement',
  rarity TEXT NOT NULL DEFAULT 'standard' CHECK (rarity IN ('standard','rare','epic','legendary')),
  image_url TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS badge_definitions_active_order_idx
  ON badge_definitions(active, sort_order, created_at DESC);

CREATE TABLE IF NOT EXISTS student_badges (
  id TEXT PRIMARY KEY NOT NULL,
  badge_id TEXT NOT NULL,
  firebase_uid TEXT NOT NULL,
  awarded_by TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '' CHECK (length(reason) <= 500),
  awarded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  revoked_by TEXT,
  revoke_reason TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (badge_id) REFERENCES badge_definitions(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS student_badges_one_active_award_idx
  ON student_badges(badge_id, firebase_uid) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS student_badges_student_active_idx
  ON student_badges(firebase_uid, revoked_at, awarded_at DESC);
CREATE INDEX IF NOT EXISTS student_badges_badge_date_idx
  ON student_badges(badge_id, awarded_at DESC);

CREATE TABLE IF NOT EXISTS badge_award_history (
  id TEXT PRIMARY KEY NOT NULL,
  award_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  firebase_uid TEXT NOT NULL,
  actor_uid TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL CHECK (action IN ('awarded','revoked')),
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (award_id) REFERENCES student_badges(id) ON DELETE RESTRICT,
  FOREIGN KEY (badge_id) REFERENCES badge_definitions(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS badge_award_history_created_idx
  ON badge_award_history(created_at DESC);
CREATE INDEX IF NOT EXISTS badge_award_history_badge_idx
  ON badge_award_history(badge_id, created_at DESC);
