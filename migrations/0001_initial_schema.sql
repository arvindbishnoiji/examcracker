-- Exam Cracker D1 schema baseline.
-- D1-compatible SQLite. JSON and array-shaped fields are stored as JSON text.
-- Firebase remains the identity provider. Passwords/credential hashes are never stored here.
-- Applying this schema does not migrate source rows or switch app APIs to D1.

CREATE TABLE IF NOT EXISTS student_profiles (
  firebase_uid TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  exam TEXT CHECK (exam IN ('JEE', 'NEET') OR exam IS NULL),
  class_level TEXT CHECK (class_level IN ('11', '12') OR class_level IS NULL),
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS student_profiles_exam_class_idx ON student_profiles(exam, class_level);
CREATE INDEX IF NOT EXISTS student_profiles_created_idx ON student_profiles(created_at DESC);

CREATE TABLE IF NOT EXISTS course_catalog (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('batch', 'series', 'lecture', 'resource', 'event', 'goal', 'test')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  exam TEXT NOT NULL CHECK (exam IN ('JEE', 'NEET', 'Both')),
  classes TEXT NOT NULL DEFAULT '["11","12"]',
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  access_code TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ec_course_catalog_feed_idx ON course_catalog(active, exam, kind, created_at DESC);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id TEXT PRIMARY KEY NOT NULL,
  firebase_uid TEXT NOT NULL,
  lecture_id TEXT NOT NULL,
  watched_seconds INTEGER NOT NULL DEFAULT 0 CHECK (watched_seconds >= 0),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(firebase_uid, lecture_id)
);
CREATE INDEX IF NOT EXISTS ec_lesson_progress_user_lecture_idx ON lesson_progress(firebase_uid, lecture_id);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  firebase_uid TEXT NOT NULL,
  test_id TEXT NOT NULL,
  exam TEXT NOT NULL CHECK (exam IN ('JEE', 'NEET')),
  class_level TEXT NOT NULL CHECK (class_level IN ('11', '12')),
  score REAL NOT NULL DEFAULT 0,
  max_score REAL NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  unanswered_count INTEGER NOT NULL DEFAULT 0,
  answers TEXT NOT NULL DEFAULT '[]',
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ec_exam_attempts_test_score_idx ON exam_attempts(test_id, exam, class_level, score DESC, submitted_at ASC);
CREATE INDEX IF NOT EXISTS ec_exam_attempts_user_idx ON exam_attempts(firebase_uid, submitted_at DESC);
CREATE INDEX IF NOT EXISTS ec_exam_attempts_submitted_at_idx ON exam_attempts(submitted_at DESC);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY NOT NULL,
  firebase_uid TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('batch', 'series')),
  item_id TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'admin_bulk', 'auto_rule', 'access_code', 'self_service', 'import')),
  granted_by TEXT,
  revoked_at TEXT,
  expires_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(firebase_uid, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS ec_enrollments_user_active_idx ON enrollments(firebase_uid, active, item_type);
CREATE INDEX IF NOT EXISTS ec_enrollments_item_idx ON enrollments(item_type, item_id);
CREATE INDEX IF NOT EXISTS enrollments_item_status_idx ON enrollments(item_type, item_id, status);
CREATE INDEX IF NOT EXISTS enrollments_uid_status_idx ON enrollments(firebase_uid, status, expires_at);

CREATE TABLE IF NOT EXISTS enrollment_events (
  id TEXT PRIMARY KEY NOT NULL,
  enrollment_id TEXT,
  firebase_uid TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('granted', 'reactivated', 'revoked', 'auto_enrolled', 'deduplicated', 'expired')),
  source TEXT NOT NULL DEFAULT 'manual',
  actor_uid TEXT NOT NULL DEFAULT '',
  actor_email TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS enrollment_events_created_idx ON enrollment_events(created_at DESC);
CREATE INDEX IF NOT EXISTS enrollment_events_item_idx ON enrollment_events(item_type, item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS enrollment_events_student_idx ON enrollment_events(firebase_uid, created_at DESC);

CREATE TABLE IF NOT EXISTS enrollment_rules (
  id TEXT PRIMARY KEY NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('batch', 'series')),
  item_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  include_future INTEGER NOT NULL DEFAULT 1 CHECK (include_future IN (0, 1)),
  respect_eligibility INTEGER NOT NULL DEFAULT 1 CHECK (respect_eligibility IN (0, 1)),
  filter_exam TEXT NOT NULL DEFAULT '' CHECK (filter_exam IN ('', 'JEE', 'NEET')),
  filter_class TEXT NOT NULL DEFAULT '' CHECK (filter_class IN ('', '11', '12')),
  expires_at TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_applied_at TEXT,
  last_applied_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(item_type, item_id)
);
CREATE INDEX IF NOT EXISTS enrollment_rules_active_idx ON enrollment_rules(active, include_future);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'All',
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  scheduled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ec_announcements_active_schedule_idx ON announcements(active, scheduled_at DESC);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY NOT NULL,
  draft TEXT NOT NULL DEFAULT '{}',
  published TEXT NOT NULL DEFAULT '{}',
  published_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS admin_activity (
  id TEXT PRIMARY KEY NOT NULL,
  actor_uid TEXT NOT NULL DEFAULT '',
  actor_email TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS admin_activity_created_at_idx ON admin_activity(created_at DESC);

CREATE TABLE IF NOT EXISTS student_library (
  id TEXT PRIMARY KEY NOT NULL,
  firebase_uid TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('bookmark', 'note', 'recent', 'challenge', 'revision')),
  item_id TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(firebase_uid, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS student_library_uid_idx ON student_library(firebase_uid, updated_at DESC);

-- Student feedback is persisted in D1, not Firestore chat.
CREATE TABLE IF NOT EXISTS feedback_threads (
  id TEXT PRIMARY KEY NOT NULL,
  firebase_uid TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  subject TEXT NOT NULL DEFAULT 'Student feedback',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  last_message_text TEXT NOT NULL DEFAULT '',
  last_message_at TEXT,
  unread_by_admin INTEGER NOT NULL DEFAULT 0 CHECK (unread_by_admin IN (0, 1)),
  unread_by_student INTEGER NOT NULL DEFAULT 0 CHECK (unread_by_student IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS feedback_threads_student_idx ON feedback_threads(firebase_uid, updated_at DESC);
CREATE INDEX IF NOT EXISTS feedback_threads_status_idx ON feedback_threads(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS feedback_messages (
  id TEXT PRIMARY KEY NOT NULL,
  thread_id TEXT NOT NULL,
  sender_uid TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('student', 'admin')),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  read_at TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(thread_id) REFERENCES feedback_threads(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS feedback_messages_thread_idx ON feedback_messages(thread_id, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY NOT NULL,
  firebase_uid TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TEXT,
  payload TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(firebase_uid, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS push_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  firebase_uid TEXT NOT NULL,
  token TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens(firebase_uid);

CREATE TABLE IF NOT EXISTS broadcasts (
  id TEXT PRIMARY KEY NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  created_at TEXT,
  payload TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS broadcasts_active_idx ON broadcasts(active, created_at DESC);
