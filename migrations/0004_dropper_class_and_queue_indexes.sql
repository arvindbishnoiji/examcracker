-- Exam Cracker D1 schema, version 4.
--
-- Non-destructive upgrade adding first-class Dropper support ('11', '12', 'Dropper')
-- to SQLite CHECK constraints on student_profiles, exam_attempts and enrollment_rules,
-- plus a composite index for subject-isolated lecture playback queues.
--
-- All existing rows, columns and indexes from 0001-0003 are preserved verbatim.
-- None of the three rebuilt tables are targets of FOREIGN KEY constraints.

-- ---------------------------------------------------------------------------
-- 1. student_profiles: widen class_level CHECK to ('11', '12', 'Dropper')
-- ---------------------------------------------------------------------------

CREATE TABLE student_profiles_v4 (
  firebase_uid TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  exam TEXT CHECK (exam IN ('JEE', 'NEET') OR exam IS NULL),
  class_level TEXT CHECK (class_level IN ('11', '12', 'Dropper') OR class_level IS NULL),
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  avatar_file_id TEXT
);

INSERT INTO student_profiles_v4 (
  firebase_uid,
  display_name,
  email,
  exam,
  class_level,
  avatar_url,
  created_at,
  updated_at,
  avatar_file_id
)
SELECT
  firebase_uid,
  display_name,
  email,
  exam,
  class_level,
  avatar_url,
  created_at,
  updated_at,
  avatar_file_id
FROM student_profiles;

DROP TABLE student_profiles;
ALTER TABLE student_profiles_v4 RENAME TO student_profiles;

CREATE INDEX IF NOT EXISTS student_profiles_exam_class_idx ON student_profiles(exam, class_level);
CREATE INDEX IF NOT EXISTS student_profiles_created_idx ON student_profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS student_profiles_avatar_file_idx ON student_profiles(avatar_file_id);

-- ---------------------------------------------------------------------------
-- 2. exam_attempts: widen class_level CHECK to ('11', '12', 'Dropper')
-- ---------------------------------------------------------------------------

CREATE TABLE exam_attempts_v4 (
  id TEXT PRIMARY KEY NOT NULL,
  firebase_uid TEXT NOT NULL,
  test_id TEXT NOT NULL,
  exam TEXT NOT NULL CHECK (exam IN ('JEE', 'NEET')),
  class_level TEXT NOT NULL CHECK (class_level IN ('11', '12', 'Dropper')),
  score REAL NOT NULL DEFAULT 0,
  max_score REAL NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  unanswered_count INTEGER NOT NULL DEFAULT 0,
  answers TEXT NOT NULL DEFAULT '[]',
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO exam_attempts_v4 (
  id,
  firebase_uid,
  test_id,
  exam,
  class_level,
  score,
  max_score,
  correct_count,
  incorrect_count,
  unanswered_count,
  answers,
  submitted_at
)
SELECT
  id,
  firebase_uid,
  test_id,
  exam,
  class_level,
  score,
  max_score,
  correct_count,
  incorrect_count,
  unanswered_count,
  answers,
  submitted_at
FROM exam_attempts;

DROP TABLE exam_attempts;
ALTER TABLE exam_attempts_v4 RENAME TO exam_attempts;

CREATE INDEX IF NOT EXISTS ec_exam_attempts_test_score_idx ON exam_attempts(test_id, exam, class_level, score DESC, submitted_at ASC);
CREATE INDEX IF NOT EXISTS ec_exam_attempts_user_idx ON exam_attempts(firebase_uid, submitted_at DESC);
CREATE INDEX IF NOT EXISTS ec_exam_attempts_submitted_at_idx ON exam_attempts(submitted_at DESC);
CREATE INDEX IF NOT EXISTS exam_attempts_test_user_idx ON exam_attempts(test_id, firebase_uid);

-- ---------------------------------------------------------------------------
-- 3. enrollment_rules: widen filter_class CHECK to ('', '11', '12', 'Dropper')
-- ---------------------------------------------------------------------------

CREATE TABLE enrollment_rules_v4 (
  id TEXT PRIMARY KEY NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('batch', 'series')),
  item_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  include_future INTEGER NOT NULL DEFAULT 1 CHECK (include_future IN (0, 1)),
  respect_eligibility INTEGER NOT NULL DEFAULT 1 CHECK (respect_eligibility IN (0, 1)),
  filter_exam TEXT NOT NULL DEFAULT '' CHECK (filter_exam IN ('', 'JEE', 'NEET')),
  filter_class TEXT NOT NULL DEFAULT '' CHECK (filter_class IN ('', '11', '12', 'Dropper')),
  expires_at TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_applied_at TEXT,
  last_applied_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(item_type, item_id)
);

INSERT INTO enrollment_rules_v4 (
  id,
  item_type,
  item_id,
  name,
  include_future,
  respect_eligibility,
  filter_exam,
  filter_class,
  expires_at,
  active,
  created_by,
  created_at,
  updated_at,
  last_applied_at,
  last_applied_count
)
SELECT
  id,
  item_type,
  item_id,
  name,
  include_future,
  respect_eligibility,
  filter_exam,
  filter_class,
  expires_at,
  active,
  created_by,
  created_at,
  updated_at,
  last_applied_at,
  last_applied_count
FROM enrollment_rules;

DROP TABLE enrollment_rules;
ALTER TABLE enrollment_rules_v4 RENAME TO enrollment_rules;

CREATE INDEX IF NOT EXISTS enrollment_rules_active_idx ON enrollment_rules(active, include_future);

-- ---------------------------------------------------------------------------
-- 4. Subject-only lecture playback queue index
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS course_catalog_subject_queue_idx
  ON course_catalog(kind, active, subject_id, parent_id, sort_order, created_at);
