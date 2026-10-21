-- Exam Cracker D1 schema, version 2.
--
-- Additive migration: 0001 may already be applied in the owner's D1 database,
-- so this file never rewrites 0001. It adds:
--   * subjects and batch/series-to-subject assignments
--   * stable parent/subject/order columns on course_catalog (backfilled from
--     the legacy JSON metadata where possible)
--   * Google Drive file metadata (file bytes never live in D1)
--   * the student profile's current profile-photo file reference
--
-- D1 is SQLite. JSON text is used only for flexible presentation metadata.

-- ---------------------------------------------------------------------------
-- Subjects
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  exam TEXT NOT NULL DEFAULT 'Both' CHECK (exam IN ('JEE', 'NEET', 'Both')),
  classes TEXT NOT NULL DEFAULT '["11","12"]',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS subjects_feed_idx ON subjects(archived, active, exam, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS subjects_name_exam_unique_idx
  ON subjects(lower(trim(name)), exam);

-- Subjects are assigned to a specific batch or series. A subject assigned to
-- one course must not appear in an unrelated course.
CREATE TABLE IF NOT EXISTS course_subjects (
  course_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (course_id, subject_id),
  FOREIGN KEY (course_id) REFERENCES course_catalog(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS course_subjects_subject_idx
  ON course_subjects(subject_id, course_id);

-- ---------------------------------------------------------------------------
-- Stable content relationships (replacing JSON-only lookups)
-- ---------------------------------------------------------------------------

ALTER TABLE course_catalog ADD COLUMN parent_id TEXT;
ALTER TABLE course_catalog ADD COLUMN subject_id TEXT;
ALTER TABLE course_catalog ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Backfill legacy rows once. json_valid() keeps a malformed legacy value from
-- aborting the whole migration.
UPDATE course_catalog
SET parent_id = CASE
  WHEN json_valid(metadata) THEN COALESCE(
    json_extract(metadata, '$.parentId'),
    json_extract(metadata, '$.parent_id'),
    json_extract(metadata, '$.batchId'),
    json_extract(metadata, '$.seriesId')
  )
  ELSE NULL
END
WHERE parent_id IS NULL;

UPDATE course_catalog
SET sort_order = CASE
  WHEN json_valid(metadata) THEN COALESCE(
    CAST(json_extract(metadata, '$.sortOrder') AS INTEGER),
    CAST(json_extract(metadata, '$.position') AS INTEGER),
    0
  )
  ELSE 0
END
WHERE sort_order = 0;

-- Only backfill a subject reference when the legacy metadata points at a real
-- subject row. Free-text `metadata.subject` strings are intentionally not
-- converted, because they cannot be trusted as foreign keys.
UPDATE course_catalog
SET subject_id = CASE
  WHEN json_valid(metadata) THEN json_extract(metadata, '$.subjectId')
  ELSE NULL
END
WHERE subject_id IS NULL
  AND EXISTS (SELECT 1 FROM subjects s WHERE s.id = json_extract(course_catalog.metadata, '$.subjectId'));

CREATE INDEX IF NOT EXISTS course_catalog_parent_idx
  ON course_catalog(parent_id, kind, active, sort_order);
CREATE INDEX IF NOT EXISTS course_catalog_subject_idx
  ON course_catalog(subject_id, kind, active, sort_order);

-- ---------------------------------------------------------------------------
-- Google Drive metadata only. File bytes stay in Drive.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS drive_files (
  id TEXT PRIMARY KEY NOT NULL,
  drive_file_id TEXT NOT NULL UNIQUE,
  owner_uid TEXT,
  uploader_uid TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('profile_photo', 'pdf')),
  course_id TEXT,
  subject_id TEXT,
  mime_type TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'superseded', 'deleted', 'orphan')),
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'authenticated', 'course')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (course_id) REFERENCES course_catalog(id) ON DELETE SET NULL,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS drive_files_owner_idx
  ON drive_files(owner_uid, purpose, status);
CREATE INDEX IF NOT EXISTS drive_files_course_idx
  ON drive_files(course_id, purpose, status);
CREATE INDEX IF NOT EXISTS drive_files_status_idx
  ON drive_files(status, updated_at DESC);

ALTER TABLE student_profiles ADD COLUMN avatar_file_id TEXT;
CREATE INDEX IF NOT EXISTS student_profiles_avatar_file_idx
  ON student_profiles(avatar_file_id);

-- ---------------------------------------------------------------------------
-- Feedback resolution timestamp (status remains in feedback_threads).
-- ---------------------------------------------------------------------------

ALTER TABLE feedback_threads ADD COLUMN resolved_at TEXT;

-- ---------------------------------------------------------------------------
-- Small helpful indexes for the admin inbox.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS feedback_threads_category_idx
  ON feedback_threads(category, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS feedback_threads_unread_idx
  ON feedback_threads(unread_by_admin, updated_at DESC);
CREATE INDEX IF NOT EXISTS exam_attempts_test_user_idx
  ON exam_attempts(test_id, firebase_uid);
