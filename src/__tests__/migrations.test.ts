import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// `node:sqlite` is a runtime builtin provided by Node 22. Loading it through
// createRequire keeps Vite from trying to bundle the builtin.
interface SqliteStatement {
  all: (...args: unknown[]) => Row[];
  get: (...args: unknown[]) => Row | undefined;
  run: (...args: unknown[]) => unknown;
}
interface SqliteDb {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
}

const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire('node:sqlite') as {
  DatabaseSync: new (path: string) => SqliteDb;
};

/**
 * Applies the real D1 migration files to an in-memory SQLite database.
 * D1 is SQLite, so this catches syntax errors, missing columns, broken
 * backfills and constraint regressions before a remote migration runs.
 */

type Row = Record<string, unknown>;


function migration(name: string): string {
  return readFileSync(resolve(process.cwd(), 'migrations', name), 'utf8');
}

function freshDatabase(): { db: SqliteDb } {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  return { db };
}

function tables(db: SqliteDb): string[] {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((row) => String(row.name));
}

function columns(db: SqliteDb, table: string): string[] {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((row) => String(row.name));
}

const EXPECTED_TABLES = [
  'admin_activity',
  'announcements',
  'broadcasts',
  'course_catalog',
  'course_subjects',
  'drive_files',
  'enrollment_events',
  'enrollment_rules',
  'enrollments',
  'exam_attempts',
  'feedback_messages',
  'feedback_threads',
  'lesson_progress',
  'notifications',
  'push_tokens',
  'site_settings',
  'student_library',
  'student_profiles',
  'subjects',
];

describe('D1 migrations 0001 → 0002', () => {
  it('applies both migrations to a fresh database and creates every required table', () => {
    const { db } = freshDatabase();
    db.exec(migration('0001_initial_schema.sql'));
    db.exec(migration('0002_subjects_and_drive_files.sql'));

    for (const table of EXPECTED_TABLES) {
      expect(tables(db)).toContain(table);
    }
  });

  it('adds hierarchy, Drive and feedback columns without replacing tables', () => {
    const { db } = freshDatabase();
    db.exec(migration('0001_initial_schema.sql'));
    db.exec(migration('0002_subjects_and_drive_files.sql'));

    expect(columns(db, 'course_catalog')).toEqual(
      expect.arrayContaining(['parent_id', 'subject_id', 'sort_order'])
    );
    expect(columns(db, 'student_profiles')).toContain('avatar_file_id');
    expect(columns(db, 'feedback_threads')).toContain('resolved_at');
    expect(columns(db, 'drive_files')).toEqual(
      expect.arrayContaining([
        'drive_file_id',
        'owner_uid',
        'uploader_uid',
        'purpose',
        'course_id',
        'subject_id',
        'mime_type',
        'display_name',
        'size_bytes',
        'status',
        'visibility',
      ])
    );
  });

  it('backfills parent, subject and order from legacy JSON metadata', () => {
    const { db } = freshDatabase();
    db.exec(migration('0001_initial_schema.sql'));
    db.prepare(
      `INSERT INTO course_catalog (id,kind,title,description,exam,classes,active,access_code,metadata,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      'batch-1',
      'batch',
      'Physics Batch',
      '',
      'JEE',
      '["11"]',
      1,
      null,
      '{}',
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z'
    );
    db.prepare(
      `INSERT INTO course_catalog (id,kind,title,description,exam,classes,active,access_code,metadata,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      'lecture-1',
      'lecture',
      'Electrostatics 1',
      '',
      'JEE',
      '["11"]',
      1,
      null,
      JSON.stringify({ parentId: 'batch-1', position: 4, videoId: 'abc' }),
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z'
    );

    db.exec(migration('0002_subjects_and_drive_files.sql'));

    const row = db.prepare('SELECT parent_id, sort_order, metadata FROM course_catalog WHERE id=?').get('lecture-1');
    expect(row?.parent_id).toBe('batch-1');
    expect(Number(row?.sort_order)).toBe(4);
    // The legacy metadata is preserved for older clients.
    expect(JSON.parse(String(row?.metadata)).videoId).toBe('abc');
  });

  it('enforces the subject uniqueness and course/subject relationship constraints', () => {
    const { db } = freshDatabase();
    db.exec(migration('0001_initial_schema.sql'));
    db.exec(migration('0002_subjects_and_drive_files.sql'));

    const insertSubject = db.prepare(
      `INSERT INTO subjects (id,name,description,exam,classes,active,archived,sort_order,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    );
    insertSubject.run('s1', 'Physics', '', 'JEE', '["11"]', 1, 0, 1, 'now', 'now');

    expect(() =>
      insertSubject.run('s2', '  physics ', '', 'JEE', '["11"]', 1, 0, 2, 'now', 'now')
    ).toThrow();
    // The same name is allowed on a different exam track.
    expect(() =>
      insertSubject.run('s3', 'Physics', '', 'NEET', '["11"]', 1, 0, 3, 'now', 'now')
    ).not.toThrow();

    db.prepare(
      `INSERT INTO course_catalog (id,kind,title,description,exam,classes,active,access_code,metadata,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run('batch-1', 'batch', 'Batch', '', 'JEE', '["11"]', 1, null, '{}', 'now', 'now');

    const assign = db.prepare(
      `INSERT INTO course_subjects (course_id,subject_id,sort_order,created_at) VALUES (?,?,?,?)`
    );
    assign.run('batch-1', 's1', 1, 'now');
    expect(() => assign.run('batch-1', 's1', 2, 'now')).toThrow();
    expect(() => assign.run('missing-course', 's1', 2, 'now')).toThrow();
  });

  it('keeps answer keys out of the public exam_attempts payload columns', () => {
    const { db } = freshDatabase();
    db.exec(migration('0001_initial_schema.sql'));
    db.exec(migration('0002_subjects_and_drive_files.sql'));
    const attemptColumns = columns(db, 'exam_attempts');
    // Scoring columns exist for server-side scoring; question/answer keys live
    // inside course_catalog.metadata and are never copied to the student row.
    expect(attemptColumns).toEqual(expect.arrayContaining(['score', 'max_score', 'correct_count']));
    expect(attemptColumns).not.toContain('questions');
    expect(attemptColumns).not.toContain('answer_key');
  });

  it('persists a Drive file record with private visibility by default', () => {
    const { db } = freshDatabase();
    db.exec(migration('0001_initial_schema.sql'));
    db.exec(migration('0002_subjects_and_drive_files.sql'));
    db.prepare(
      `INSERT INTO drive_files (id,drive_file_id,owner_uid,uploader_uid,purpose,mime_type,display_name,size_bytes,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).run('d1', 'drive-1', 'user-1', 'user-1', 'profile_photo', 'image/png', 'photo.png', 100, 'now', 'now');
    const row = db.prepare('SELECT visibility,status FROM drive_files WHERE id=?').get('d1');
    expect(row?.visibility).toBe('private');
    expect(row?.status).toBe('active');

    expect(() =>
      db
        .prepare(
          `INSERT INTO drive_files (id,drive_file_id,owner_uid,uploader_uid,purpose,mime_type,display_name,size_bytes,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`
        )
        .run('d2', 'drive-1', 'user-1', 'user-1', 'profile_photo', 'image/png', 'dup.png', 100, 'now', 'now')
    ).toThrow();
  });
});

describe('D1 migration 0005 (badges and award history)', () => {
  it('adds normalized badge tables and prevents duplicate active awards while retaining revocation history', () => {
    const { db } = freshDatabase();
    db.exec(migration('0001_initial_schema.sql'));
    db.exec(migration('0002_subjects_and_drive_files.sql'));
    db.exec(migration('0005_badges.sql'));
    expect(tables(db)).toEqual(expect.arrayContaining(['badge_definitions', 'student_badges', 'badge_award_history']));
    db.prepare(`INSERT INTO student_profiles (firebase_uid,display_name,email,exam,class_level) VALUES (?,?,?,?,?)`).run('student-x', 'Student X', 'x@example.com', 'JEE', '11');
    db.prepare(`INSERT INTO badge_definitions (id,title,category,created_by) VALUES (?,?,?,?)`).run('badge-x', 'Physics Master', 'achievement', 'admin');
    db.prepare(`INSERT INTO student_badges (id,badge_id,firebase_uid,awarded_by) VALUES (?,?,?,?)`).run('award-x', 'badge-x', 'student-x', 'admin');
    expect(() => db.prepare(`INSERT INTO student_badges (id,badge_id,firebase_uid,awarded_by) VALUES (?,?,?,?)`).run('award-duplicate', 'badge-x', 'student-x', 'admin')).toThrow();
    db.prepare(`UPDATE student_badges SET revoked_at=?,revoked_by=?,revoke_reason=? WHERE id=?`).run('2026-01-02T00:00:00Z', 'admin', 'Correction', 'award-x');
    expect(() => db.prepare(`INSERT INTO student_badges (id,badge_id,firebase_uid,awarded_by) VALUES (?,?,?,?)`).run('award-reissue', 'badge-x', 'student-x', 'admin')).not.toThrow();
    expect(Number((db.prepare('SELECT COUNT(*) AS n FROM student_badges').get() as Row)?.n)).toBe(2);
  });
});

describe('D1 migration 0004 (Dropper class & subject queue index)', () => {
  it('upgrades an existing 0001-0003 database non-destructively without losing rows', () => {
    const { db } = freshDatabase();
    db.exec(migration('0001_initial_schema.sql'));
    db.exec(migration('0002_subjects_and_drive_files.sql'));
    db.exec(migration('0003_seed_starter_catalogue.sql'));

    db.prepare(
      `INSERT INTO student_profiles (firebase_uid,display_name,email,exam,class_level,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?)`
    ).run('uid-existing-12', 'Rohan', 'rohan@example.com', 'JEE', '12', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

    const catalogBefore = Number((db.prepare('SELECT COUNT(*) AS n FROM course_catalog').get() as Row)?.n || 0);
    expect(catalogBefore).toBeGreaterThan(0);

    db.exec(migration('0004_dropper_class_and_queue_indexes.sql'));

    // Existing data preserved intact
    const preserved = db.prepare('SELECT display_name, exam, class_level FROM student_profiles WHERE firebase_uid=?').get('uid-existing-12');
    expect(preserved).toEqual({ display_name: 'Rohan', exam: 'JEE', class_level: '12' });
    const catalogAfter = Number((db.prepare('SELECT COUNT(*) AS n FROM course_catalog').get() as Row)?.n || 0);
    expect(catalogAfter).toBe(catalogBefore);

    // Dropper class is now accepted in student_profiles, exam_attempts, and enrollment_rules
    expect(() =>
      db
        .prepare(
          `INSERT INTO student_profiles (firebase_uid,display_name,email,exam,class_level,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?)`
        )
        .run('uid-dropper-1', 'Ananya', 'ananya@example.com', 'NEET', 'Dropper', 'now', 'now')
    ).not.toThrow();

    db.prepare(
      `INSERT INTO course_catalog (id,kind,title,description,exam,classes,active,metadata,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).run('test-drop-1', 'test', 'NEET Full Mock', '', 'NEET', '["Dropper"]', 1, '{}', 'now', 'now');

    expect(() =>
      db
        .prepare(
          `INSERT INTO exam_attempts (id,firebase_uid,test_id,exam,class_level,score,max_score,correct_count,incorrect_count,unanswered_count,answers,submitted_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run('att-drop-1', 'uid-dropper-1', 'test-drop-1', 'NEET', 'Dropper', 680, 720, 170, 5, 5, '{}', 'now')
    ).not.toThrow();

    expect(() =>
      db
        .prepare(
          `INSERT INTO enrollment_rules (id,name,item_type,item_id,filter_exam,filter_class,respect_eligibility,active,created_by,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run('rule-drop-1', 'NEET Dropper Rule', 'batch', 'batch-any', 'NEET', 'Dropper', 1, 1, 'admin', 'now', 'now')
    ).not.toThrow();

    // Invalid class levels are still rejected by SQLite CHECK constraints
    expect(() =>
      db
        .prepare(
          `INSERT INTO student_profiles (firebase_uid,display_name,email,exam,class_level,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?)`
        )
        .run('uid-invalid', 'Invalid', 'inv@example.com', 'JEE', '10', 'now', 'now')
    ).toThrow();

    // Subject queue index exists
    const idx = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='course_catalog_subject_queue_idx'")
      .get();
    expect(idx?.name).toBe('course_catalog_subject_queue_idx');
  });
});
