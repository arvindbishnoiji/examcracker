/**
 * Exam Cracker Cloudflare Worker API.
 *
 * Identity:      Firebase Authentication ID tokens (JWKS verified per request)
 * Structured DB: Cloudflare D1 (binding DB)
 * Files:         Google Drive through server-side service-account credentials
 *
 * The Worker is imported by the same-origin Next.js route
 * `src/app/api/ec/[...path]/route.ts`, so the browser only ever talks to
 * `/api/ec/*`. No Supabase or Firestore runtime dependency remains.
 */

import {
  deleteDriveFile,
  downloadDriveFile,
  uploadDriveFile,
} from "./drive.js";
import { RUNTIME_MIGRATIONS } from "./runtime-migrations.js";

const FIREBASE_PROJECT_ID = "darvo1";
const ADMIN_EMAIL = "arvinddarabishnoi@gmail.com";
const ALLOWED_ORIGINS = new Set([
  "https://examcrack.pages.dev",
  "https://exam-cracker-web.arvinddara0290.workers.dev",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const MAX_BODY_BYTES = 512 * 1024;
const SITE_SETTING_KEYS = new Set([
  "theme",
  "login",
  "homepage",
  "navigation",
  "footer",
  "banners",
  "popups",
  "testimonials",
  "challenges",
  "features",
  "seo",
  "media",
  "lectures",
  "lecturePlayer",
  "tests",
  "testPlayer",
  "leaderboard",
  "profile",
  "eventsScreen",
  "challengesScreen",
  "chat",
  "notifications",
  "search",
  "onboarding",
]);
const FEEDBACK_CATEGORIES = new Set(["general", "content", "tests", "technical", "suggestion"]);
const FEEDBACK_STATUSES = new Set(["open", "in_progress", "resolved"]);
const LIBRARY_TYPES = new Set(["bookmark", "note", "recent", "challenge", "revision"]);
const COURSE_KINDS = new Set(["batch", "series", "lecture", "resource", "event", "goal", "test"]);

let jwksCache = { keys: [], expiresAt: 0 };

const json = (data, status = 200, extraHeaders = {}) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });

const fail = (error, status = 400, detail) =>
  json({ error, ...(detail ? { detail } : {}) }, status);

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const asBool = (value) => value === true || value === 1 || value === "1";
const asText = (value, max = 1000) => String(value === undefined || value === null ? "" : value).trim().slice(0, max);

function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function readJson(value, fallback = {}) {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed === null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function readStringArray(value, fallback = []) {
  const parsed = Array.isArray(value) ? value : readJson(value, fallback);
  return Array.isArray(parsed) ? parsed.map(String) : fallback;
}

const b64url = (value) =>
  value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);

function decodeB64urlJson(value) {
  return JSON.parse(atob(b64url(value)));
}

async function readBody(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw httpError("Request body is too large.", 413);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    throw httpError("Request body is too large.", 413);
  }
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw httpError("Invalid JSON body.", 400);
  }
}

async function loadJwks(force = false) {
  if (!force && jwksCache.expiresAt > Date.now() && jwksCache.keys.length) {
    return jwksCache.keys;
  }
  const response = await fetch(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
    { headers: { Accept: "application/json" } }
  );
  if (!response.ok) throw httpError("Unable to verify the Firebase session right now.", 503);
  const payload = await response.json();
  jwksCache = {
    keys: Array.isArray(payload.keys) ? payload.keys : [],
    expiresAt: Date.now() + 45 * 60 * 1000,
  };
  return jwksCache.keys;
}

async function verifyFirebaseToken(request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw httpError("Sign-in required.", 401);
  const token = match[1];
  const parts = token.split(".");
  if (parts.length !== 3) throw httpError("Invalid Firebase session.", 401);

  let header;
  let claims;
  try {
    header = decodeB64urlJson(parts[0]);
    claims = decodeB64urlJson(parts[1]);
  } catch {
    throw httpError("Invalid Firebase session.", 401);
  }
  if (header.alg !== "RS256" || !header.kid) {
    throw httpError("Unsupported Firebase token.", 401);
  }

  const issuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
  const current = Math.floor(Date.now() / 1000);
  if (
    claims.aud !== FIREBASE_PROJECT_ID ||
    claims.iss !== issuer ||
    typeof claims.sub !== "string" ||
    !claims.sub ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= current ||
    !Number.isFinite(claims.iat) ||
    claims.iat > current + 60
  ) {
    throw httpError("Firebase session is invalid or expired.", 401);
  }

  let jwks = await loadJwks();
  let jwk = jwks.find((item) => item.kid === header.kid);
  if (!jwk) {
    jwks = await loadJwks(true);
    jwk = jwks.find((item) => item.kid === header.kid);
  }
  if (!jwk) throw httpError("Could not verify the Firebase signing key.", 401);

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signature = Uint8Array.from(atob(b64url(parts[2])), (character) => character.charCodeAt(0));
  const message = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const valid = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    signature,
    message
  );
  if (!valid) throw httpError("Firebase session signature is invalid.", 401);

  return {
    uid: claims.sub,
    email: typeof claims.email === "string" ? claims.email.toLowerCase() : "",
    name: typeof claims.name === "string" ? claims.name : "",
    picture: typeof claims.picture === "string" ? claims.picture : null,
    claims,
  };
}

const isAdmin = (user) => user.email === ADMIN_EMAIL;

function requireAdmin(user) {
  if (!isAdmin(user)) {
    throw httpError(
      "Admin access is restricted to the configured administrator email.",
      403
    );
  }
}

function assertDb(env) {
  if (!env || !env.DB || typeof env.DB.prepare !== "function") {
    throw httpError(
      "Cloudflare D1 binding DB is unavailable. Check the exam-cracker-web Wrangler binding.",
      503
    );
  }
  return env.DB;
}

async function all(db, sql, ...values) {
  const statement = db.prepare(sql);
  const result = values.length ? await statement.bind(...values).all() : await statement.all();
  if (result.success === false) throw httpError("Database query failed.", 500);
  return result.results || [];
}

async function first(db, sql, ...values) {
  const statement = db.prepare(sql);
  return values.length ? statement.bind(...values).first() : statement.first();
}

async function run(db, sql, ...values) {
  const statement = db.prepare(sql);
  const result = values.length ? await statement.bind(...values).run() : await statement.run();
  if (result.success === false) throw httpError("Database write failed.", 500);
  return result;
}

async function batch(db, statements) {
  if (!statements.length) return [];
  const result = await db.batch(statements);
  return Array.isArray(result) ? result : [];
}

async function activity(db, user, action, targetType = "", targetId = "", summary = "", metadata = {}) {
  await run(
    db,
    "INSERT INTO admin_activity (id,actor_uid,actor_email,action,target_type,target_id,summary,metadata,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    uuid(),
    user.uid,
    user.email,
    action,
    targetType,
    targetId,
    summary,
    JSON.stringify(metadata || {}),
    now()
  );
}

function isSafeHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\/[^\s]+$/i.test(value.trim());
}

// ---------------------------------------------------------------------------
// Domain mappers
// ---------------------------------------------------------------------------

function mapProfile(row) {
  if (!row) return null;
  const avatarFileId = row.avatar_file_id || null;
  return {
    ...row,
    exam: row.exam || null,
    class_level: row.class_level || null,
    avatar_file_id: avatarFileId,
    // The authenticated file route is the only supported profile-photo URL.
    avatar_url: avatarFileId
      ? `/api/ec/files/${encodeURIComponent(avatarFileId)}`
      : row.avatar_url || null,
  };
}

function mapCourse(row, admin = false) {
  if (!row) return null;
  const metadata = readJson(row.metadata, {});
  const classes = readStringArray(row.classes, ["11", "12"]);
  const parentId =
    row.parent_id ||
    metadata.parentId ||
    metadata.parent_id ||
    metadata.batchId ||
    metadata.seriesId ||
    null;
  const subjectId = row.subject_id || metadata.subjectId || null;
  const sortOrder = Number(row.sort_order ?? metadata.sortOrder ?? metadata.position ?? 0) || 0;

  const output = {
    ...row,
    classes,
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    active: asBool(row.active),
    hasAccessCode: Boolean(
      row.access_code || metadata.requiresAccessCode || metadata.hasAccessCode
    ),
    parentId: parentId || null,
    subjectId: subjectId || null,
    subjectName: row.subject_name || null,
    sortOrder,
  };
  if (!admin) {
    delete output.access_code;
    if (output.kind === "test" && Array.isArray(output.metadata.questions)) {
      output.metadata = {
        ...output.metadata,
        questions: output.metadata.questions.map(redactQuestion),
      };
    }
  }
  return output;
}

function mapTestCard(row) {
  const course = mapCourse(row, false);
  if (!course) return null;
  const metadata = course.metadata || {};
  const questions = Array.isArray(metadata.questions) ? metadata.questions : [];
  const startsAt = metadata.scheduledAt || metadata.scheduled_at || null;
  const endsAt = metadata.endsAt || metadata.ends_at || null;
  const starts = startsAt ? Date.parse(startsAt) : NaN;
  const ends = endsAt ? Date.parse(endsAt) : NaN;
  const nowMs = Date.now();
  const inWindow =
    (!Number.isFinite(starts) || starts <= nowMs) && (!Number.isFinite(ends) || ends >= nowMs);
  const totalMarks =
    Number(metadata.totalMarks ?? metadata.total_marks) ||
    questions.reduce((sum, question) => sum + (Number(question.marks) || 0), 0) ||
    null;
  return {
    id: course.id,
    kind: "test",
    title: course.title,
    description: course.description,
    exam: course.exam,
    classes: course.classes,
    active: course.active,
    thumbnailUrl: metadata.thumbnailUrl || null,
    scheduledAt: startsAt,
    endsAt,
    durationMinutes: Number(metadata.durationMinutes ?? metadata.duration_minutes ?? 0) || 0,
    totalQuestions: Number(metadata.totalQuestions ?? metadata.total_questions) || questions.length,
    totalMarks,
    isLive: metadata.isLive === true || (Boolean(startsAt || endsAt) && inWindow),
    subject: metadata.subject || course.subjectName || null,
  };
}

function redactQuestion(question) {
  const copy = { ...question };
  for (const key of [
    "answer",
    "correctAnswer",
    "correct_answer",
    "answerKey",
    "explanation",
    "rationale",
  ]) {
    delete copy[key];
  }
  return copy;
}

function mapReviewItem(item) {
  const selected = item.answer ?? item.selectedAnswer ?? null;
  return {
    ...item,
    answer: selected,
    selectedAnswer: selected,
    marksAwarded: Number(item.marksAwarded ?? item.marks ?? 0),
  };
}

function mapAnnouncement(row) {
  return { ...row, active: asBool(row.active) };
}

function mapFeedbackThread(row) {
  if (!row) return null;
  return {
    ...row,
    unread_by_admin: asBool(row.unread_by_admin),
    unread_by_student: asBool(row.unread_by_student),
  };
}

function mapFeedbackMessage(row) {
  return {
    id: row.id,
    senderUid: row.sender_uid,
    senderUidLegacy: row.sender_uid,
    senderRole: row.sender_role,
    text: row.text,
    createdAt: row.created_at,
    readAt: row.read_at,
    isRead: asBool(row.is_read),
  };
}

function mapDriveFile(row) {
  if (!row) return null;
  return {
    id: row.id,
    purpose: row.purpose,
    mimeType: row.mime_type,
    displayName: row.display_name,
    sizeBytes: Number(row.size_bytes) || 0,
    courseId: row.course_id || null,
    courseTitle: row.course_title || null,
    subjectId: row.subject_id || null,
    ownerUid: row.owner_uid || null,
    uploaderUid: row.uploader_uid || null,
    status: row.status,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    downloadUrl: `/api/ec/files/${encodeURIComponent(row.id)}`,
  };
}

function mapSubject(row, assignments = [], lectureCount = 0) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    exam: row.exam,
    classes: readStringArray(row.classes, ["11", "12"]),
    active: asBool(row.active),
    archived: asBool(row.archived),
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignmentCount: assignments.length,
    lectureCount,
    assignments,
  };
}

// ---------------------------------------------------------------------------
// Content + access helpers
// ---------------------------------------------------------------------------

async function getProfile(db, uid) {
  return mapProfile(await first(db, "SELECT * FROM student_profiles WHERE firebase_uid = ?", uid));
}

function requireProfile(profile) {
  if (!profile) throw httpError("Finish onboarding first.", 409);
}

function examCompatible(a, b) {
  return a === "Both" || b === "Both" || a === b;
}

function classOverlap(a, b) {
  const left = readStringArray(a, []);
  const right = readStringArray(b, []);
  return left.some((item) => right.includes(item));
}

function profileMatchesCourse(course, profile) {
  if (!profile) return false;
  if (!examCompatible(course.exam, profile.exam)) return false;
  return readStringArray(course.classes, []).includes(profile.class_level);
}

function visibleBySchedule(row) {
  const metadata = row.metadata || {};
  const starts = metadata.startsAt ? Date.parse(metadata.startsAt) : NaN;
  const ends = metadata.endsAt ? Date.parse(metadata.endsAt) : NaN;
  const current = Date.now();
  return (!Number.isFinite(starts) || starts <= current) && (!Number.isFinite(ends) || ends >= current);
}

function isPreviewContent(row) {
  const metadata = row.metadata || {};
  return metadata.isPreview === true || metadata.preview === true;
}

async function courseRow(db, id) {
  return first(
    db,
    `SELECT c.*, s.name AS subject_name, s.active AS subject_active,
            s.archived AS subject_archived, s.exam AS subject_exam,
            s.classes AS subject_classes
       FROM course_catalog c
       LEFT JOIN subjects s ON s.id = c.subject_id
      WHERE c.id = ?`,
    id
  );
}

async function contentRows(
  db,
  { activeOnly = false, kind = "", exam = "", classLevel = "", parentId = "", subjectId = "" } = {}
) {
  const clauses = [];
  const values = [];
  if (kind) {
    clauses.push("c.kind = ?");
    values.push(kind);
  }
  if (activeOnly) clauses.push("c.active = 1");
  if (exam) {
    clauses.push("(c.exam = ? OR c.exam = 'Both')");
    values.push(exam);
  }
  if (subjectId) {
    clauses.push("c.subject_id = ?");
    values.push(subjectId);
  }
  const sql = `SELECT c.*, s.name AS subject_name, s.active AS subject_active,
                      s.archived AS subject_archived
                 FROM course_catalog c
                 LEFT JOIN subjects s ON s.id = c.subject_id
                ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}`;
  const rows = await all(db, sql, ...values);
  return rows
    .map((row) => mapCourse(row, false))
    .filter((row) => {
      if (activeOnly && row.subjectId && !asBool(row.subject_active)) return false;
      if (classLevel && !row.classes.includes(classLevel)) return false;
      if (parentId && String(row.parentId || "") !== parentId) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return String(a.created_at).localeCompare(String(b.created_at));
    });
}

async function hasEnrollment(db, uid, itemId) {
  const row = await first(
    db,
    "SELECT id FROM enrollments WHERE firebase_uid=? AND item_id=? AND active=1 AND status='active' AND (expires_at IS NULL OR expires_at > ?)",
    uid,
    itemId,
    now()
  );
  return Boolean(row);
}

async function canAccessCourse(db, user, row, profile, admin = false) {
  if (admin || isAdmin(user)) return true;
  if (!row || !asBool(row.active)) return false;
  if (row.subject_id && !asBool(row.subject_active)) return false;
  const course = mapCourse(row, false);
  if (!profileMatchesCourse(course, profile)) return false;
  if (!course.parentId) return true;
  const parent = await courseRow(db, course.parentId);
  if (!parent || !asBool(parent.active) || !["batch", "series"].includes(parent.kind)) return false;
  if (!profileMatchesCourse(mapCourse(parent, false), profile)) return false;
  if (isPreviewContent(course)) return true;
  return hasEnrollment(db, user.uid, course.parentId);
}

/**
 * Course-scoped file access. A PDF attached to a batch/series requires an active
 * enrollment in that course; attaching it to a lecture/resource follows the
 * lecture access rules (enrollment or preview). Admins bypass this check.
 */
async function canAccessCourseFiles(db, user, row, profile) {
  if (!row || isAdmin(user)) return Boolean(row);
  if (!asBool(row.active)) return false;
  const course = mapCourse(row, false);
  if (!profileMatchesCourse(course, profile)) return false;
  if (["batch", "series"].includes(row.kind)) {
    return hasEnrollment(db, user.uid, row.id);
  }
  return canAccessCourse(db, user, row, profile, false);
}

async function validateCourseRelations(db, kind, parentId, subjectId, existing = null) {
  if (!["lecture", "resource"].includes(kind)) {
    if (parentId || subjectId) {
      throw httpError("Only lectures and resources can belong to a subject inside a batch or series.");
    }
    return { parentId: null, subjectId: null };
  }
  let parent = null;
  if (parentId) {
    parent = await courseRow(db, parentId);
    if (!parent) throw httpError("The selected batch or series was not found.", 400);
    if (!["batch", "series"].includes(parent.kind)) {
      throw httpError("Lectures and resources can only be attached to a batch or series.");
    }
    if (!subjectId) {
      throw httpError("Choose a subject assigned to the selected batch or series.");
    }
  }
  if (subjectId) {
    if (!parentId) {
      throw httpError("Choose a parent batch or series before selecting a subject.");
    }
    const assignment = await first(
      db,
      `SELECT cs.course_id, cs.subject_id, s.name, s.active, s.archived
         FROM course_subjects cs
         JOIN subjects s ON s.id = cs.subject_id
        WHERE cs.course_id = ? AND cs.subject_id = ?`,
      parentId,
      subjectId
    );
    if (!assignment) {
      throw httpError("This subject is not assigned to the selected batch or series.");
    }
    const unchanged =
      existing &&
      String(existing.parent_id || existing.parentId || "") === parentId &&
      String(existing.subject_id || existing.subjectId || "") === subjectId;
    if (!unchanged && (!asBool(assignment.active) || asBool(assignment.archived))) {
      throw httpError("This subject is archived or inactive. Choose an active subject.");
    }
  }
  return { parentId: parentId || null, subjectId: subjectId || null };
}

function coursePayload(body) {
  const kind = asText(body.kind, 20);
  const title = asText(body.title, 180);
  const description = String(body.description || "").slice(0, 12000);
  const exam = asText(body.exam || "Both", 10) || "Both";
  const classes = Array.from(
    new Set((Array.isArray(body.classes) ? body.classes : ["11", "12"]).map(String))
  );
  if (!COURSE_KINDS.has(kind)) throw httpError("Invalid content type.");
  if (!title || title.length > 180) {
    throw httpError("Title is required and must be 180 characters or fewer.");
  }
  if (!["JEE", "NEET", "Both"].includes(exam)) throw httpError("Invalid exam track.");
  if (!classes.length || classes.some((item) => !["11", "12"].includes(item))) {
    throw httpError("Choose Class 11, Class 12, or both.");
  }
  const metadata =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? body.metadata
      : {};
  const accessCodeRaw =
    body.accessCode === undefined ? body.access_code ?? null : body.accessCode;
  const accessCode = accessCodeRaw === null || accessCodeRaw === undefined
    ? null
    : asText(accessCodeRaw, 80) || null;
  if (accessCode && !["batch", "series"].includes(kind)) {
    throw httpError("Access codes are only supported for batches and series.");
  }
  return {
    kind,
    title,
    description,
    exam,
    classes,
    active: body.active === true,
    accessCode,
    metadata,
    parentId: asText(body.parentId, 120) || null,
    subjectId: asText(body.subjectId, 120) || null,
    sortOrder: Math.max(0, Math.min(100000, Number(body.sortOrder ?? 0) || 0)),
  };
}

function withRelationMetadata(payload, relations) {
  const {
    parentId: _legacyParentId,
    parent_id: _legacyParentIdSnake,
    batchId: _legacyBatchId,
    seriesId: _legacySeriesId,
    subjectId: _legacySubjectId,
    subject_id: _legacySubjectIdSnake,
    position: _legacyPosition,
    sortOrder: _legacySortOrder,
    ...metadata
  } = payload.metadata || {};
  return {
    ...metadata,
    ...(relations.parentId ? { parentId: relations.parentId } : {}),
    ...(relations.subjectId ? { subjectId: relations.subjectId } : {}),
    ...(payload.sortOrder ? { position: payload.sortOrder } : {}),
  };
}

// ---------------------------------------------------------------------------
// Test scoring
// ---------------------------------------------------------------------------

function scoreTest(test, submittedAnswers) {
  const metadata = test.metadata || {};
  const questions = Array.isArray(metadata.questions) ? metadata.questions : [];
  const defaultMarks = Number(metadata.marksPerQuestion ?? metadata.marks_per_question ?? 4);
  const negativeMarks = Math.max(
    0,
    Number(metadata.negativeMarks ?? metadata.negativeMarking ?? metadata.negative_marks ?? 1)
  );
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  let score = 0;
  let maxScore = 0;

  const review = questions.map((question, index) => {
    const questionId = String(question.id ?? question.questionId ?? index);
    const given =
      submittedAnswers[questionId] ?? submittedAnswers[String(index)] ?? "";
    const expected =
      question.correctAnswer ??
      question.correct_answer ??
      question.answer ??
      question.answerKey ??
      null;
    const marks = Number(question.marks ?? defaultMarks);
    if (Number.isFinite(marks)) maxScore += marks;
    const normalise = (value) =>
      Array.isArray(value)
        ? value.map(String).sort().join("|")
        : String(value ?? "").trim().toLowerCase();
    const answered = given !== "" && given !== null && given !== undefined;
    const isCorrect = answered && expected !== null && normalise(given) === normalise(expected);
    if (!answered) unanswered += 1;
    else if (isCorrect) {
      correct += 1;
      score += marks;
    } else {
      incorrect += 1;
      score -= negativeMarks;
    }
    const awarded = isCorrect ? marks : answered ? -negativeMarks : 0;
    return {
      questionId,
      prompt: String(question.question || question.prompt || question.text || ""),
      options: question.options || [],
      selectedAnswer: given,
      answer: given,
      correctAnswer: expected,
      isCorrect: Boolean(isCorrect),
      explanation: question.explanation || question.rationale || "",
      marks: awarded,
      marksAwarded: awarded,
    };
  });

  const boundedScore = Math.max(-maxScore, score);
  return {
    score: boundedScore,
    maxScore,
    correct,
    incorrect,
    unanswered,
    questionsCount: questions.length,
    percentage: maxScore > 0 ? (Math.max(0, boundedScore) / maxScore) * 100 : 0,
    review,
  };
}

function parseAttempt(row) {
  if (!row) return null;
  const answers = readJson(row.answers, {});
  const normalised =
    answers && typeof answers === "object" && (answers.submitted || answers.review)
      ? answers
      : {
          submitted: answers && typeof answers === "object" ? answers : {},
          review: [],
        };
  return { ...row, answers: normalised };
}

async function logNotification(db, uid, input) {
  await run(
    db,
    "INSERT INTO notifications (id,firebase_uid,is_read,created_at,payload) VALUES (?,?,?,?,?)",
    uuid(),
    uid,
    0,
    now(),
    JSON.stringify({
      title: asText(input.title, 160),
      body: asText(input.body, 2000),
      deepLink: input.deepLink || null,
      type: input.type || "info",
    })
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

async function listStudentFeedback(db, uid) {
  const rows = await all(
    db,
    "SELECT * FROM feedback_threads WHERE firebase_uid=? ORDER BY updated_at DESC LIMIT 100",
    uid
  );
  return rows.map((row) => ({
    ...mapFeedbackThread(row),
    lastMessageText: row.last_message_text || "",
    lastMessageAt: row.last_message_at || row.updated_at,
  }));
}

async function listFeedbackMessages(db, threadId) {
  const rows = await all(
    db,
    "SELECT * FROM feedback_messages WHERE thread_id=? ORDER BY created_at ASC LIMIT 250",
    threadId
  );
  return rows.map(mapFeedbackMessage);
}

// ---------------------------------------------------------------------------
// Google Drive upload helpers
// ---------------------------------------------------------------------------

function maxUploadBytes(env, name, fallbackMb) {
  const configured = Number(env && env[name]);
  const megabytes =
    Number.isFinite(configured) && configured > 0 ? Math.min(configured, 100) : fallbackMb;
  return Math.round(megabytes * 1024 * 1024);
}

function detectProfilePhoto(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mimeType: "image/webp", extension: "webp" };
  }
  return null;
}

function detectPdf(bytes) {
  let offset = 0;
  while (offset < 8 && [0x09, 0x0a, 0x0d, 0x20].includes(bytes[offset])) offset += 1;
  return (
    bytes.length >= offset + 5 &&
    bytes[offset] === 0x25 &&
    bytes[offset + 1] === 0x50 &&
    bytes[offset + 2] === 0x44 &&
    bytes[offset + 3] === 0x46 &&
    bytes[offset + 4] === 0x2d
  );
}

function safeDisplayName(value, fallback) {
  const raw = String(value || "")
    .split(/[\\/]/)
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (raw || fallback).slice(0, 140);
}

async function readMultipartFile(request, maxBytes) {
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("multipart/form-data")) {
    throw httpError("Upload must use multipart/form-data.", 415);
  }
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes + 1024 * 1024) {
    throw httpError("The uploaded file is too large.", 413);
  }
  let form;
  try {
    form = await request.formData();
  } catch {
    throw httpError("The upload could not be read.", 400);
  }
  const value = form.get("file");
  if (
    !value ||
    typeof value === "string" ||
    typeof value.arrayBuffer !== "function" ||
    !Number.isFinite(Number(value.size))
  ) {
    throw httpError("Choose a file to upload.", 400);
  }
  const size = Number(value.size);
  if (size <= 0) throw httpError("The selected file is empty.", 400);
  if (size > maxBytes) throw httpError("The uploaded file is too large.", 413);
  const bytes = new Uint8Array(await value.arrayBuffer());
  if (bytes.length > maxBytes) throw httpError("The uploaded file is too large.", 413);
  return { form, value, bytes };
}

function contentDisposition(name, download) {
  const ascii = (name || "file").replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(name || "file").replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

async function authorizedFileRow(db, user, id) {
  const row = await first(
    db,
    `SELECT d.*, c.title AS course_title, c.active AS course_active
       FROM drive_files d
       LEFT JOIN course_catalog c ON c.id = d.course_id
      WHERE d.id = ?`,
    id
  );
  if (!row || row.status !== "active") throw httpError("File not found.", 404);
  if (isAdmin(user)) return row;
  if (row.purpose === "profile_photo") return row;
  if (row.owner_uid && row.owner_uid === user.uid) return row;
  if (row.purpose === "pdf" && row.course_id) {
    const profile = await getProfile(db, user.uid);
    requireProfile(profile);
    const course = await courseRow(db, row.course_id);
    if (!course) throw httpError("File not found.", 404);
    if (!(await canAccessCourseFiles(db, user, course, profile))) {
      throw httpError("You do not have access to this file.", 403);
    }
    return row;
  }
  throw httpError("You do not have access to this file.", 403);
}

// ---------------------------------------------------------------------------
// Subject helpers
// ---------------------------------------------------------------------------

async function subjectAssignments(db, subjectIds) {
  if (!subjectIds.length) return new Map();
  const placeholders = subjectIds.map(() => "?").join(",");
  const rows = await all(
    db,
    `SELECT cs.subject_id, cs.course_id, c.title AS course_title, c.kind AS course_kind,
            (SELECT COUNT(*) FROM course_catalog x
              WHERE x.subject_id = cs.subject_id AND x.parent_id = cs.course_id) AS lecture_count
       FROM course_subjects cs
       JOIN course_catalog c ON c.id = cs.course_id
      WHERE cs.subject_id IN (${placeholders})
      ORDER BY c.kind, c.title`,
    ...subjectIds
  );
  const grouped = new Map();
  for (const row of rows) {
    const list = grouped.get(row.subject_id) || [];
    list.push({
      courseId: row.course_id,
      courseTitle: row.course_title,
      courseKind: row.course_kind,
      lectureCount: Number(row.lecture_count) || 0,
    });
    grouped.set(row.subject_id, list);
  }
  return grouped;
}

async function subjectUsage(db) {
  const rows = await all(
    db,
    "SELECT subject_id, COUNT(*) AS n FROM course_catalog WHERE subject_id IS NOT NULL GROUP BY subject_id"
  );
  return new Map(rows.map((row) => [row.subject_id, Number(row.n) || 0]));
}

async function adminSubjectList(db, { query = "", exam = "", classLevel = "", includeArchived = true } = {}) {
  const rows = await all(db, "SELECT * FROM subjects ORDER BY archived, sort_order, lower(name)");
  const ids = rows.map((row) => row.id);
  const assignments = await subjectAssignments(db, ids);
  const usage = await subjectUsage(db);
  const q = query.trim().toLowerCase();
  return rows
    .map((row) => mapSubject(row, assignments.get(row.id) || [], usage.get(row.id) || 0))
    .filter((subject) => {
      if (!includeArchived && (subject.archived || !subject.active)) return false;
      if (exam && !examCompatible(subject.exam, exam)) return false;
      if (classLevel && !subject.classes.includes(classLevel)) return false;
      if (
        q &&
        !`${subject.name} ${subject.description} ${subject.assignments.map((item) => item.courseTitle).join(" ")}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
}

async function replaceCourseSubjects(db, user, courseId, subjectIds, force) {
  const course = await courseRow(db, courseId);
  if (!course) throw httpError("Batch or series not found.", 404);
  if (!["batch", "series"].includes(course.kind)) {
    throw httpError("Subjects can only be assigned to a batch or series.");
  }
  const uniqueIds = Array.from(new Set((Array.isArray(subjectIds) ? subjectIds : []).map(String))).slice(0, 200);
  const current = await all(db, "SELECT subject_id FROM course_subjects WHERE course_id=?", courseId);
  const currentIds = new Set(current.map((row) => row.subject_id));
  const targetIds = new Set(uniqueIds);

  let subjects = [];
  if (uniqueIds.length) {
    const placeholders = uniqueIds.map(() => "?").join(",");
    subjects = await all(db, `SELECT * FROM subjects WHERE id IN (${placeholders})`, ...uniqueIds);
    if (subjects.length !== uniqueIds.length) throw httpError("One or more subjects were not found.", 400);
  }
  for (const subject of subjects) {
    if (!asBool(subject.active) || asBool(subject.archived)) {
      throw httpError(`“${subject.name}” is archived or inactive.`, 400);
    }
    if (!examCompatible(subject.exam, course.exam)) {
      throw httpError(`“${subject.name}” is not available for this ${course.exam} course.`, 400);
    }
    if (!classOverlap(subject.classes, course.classes)) {
      throw httpError(`“${subject.name}” does not cover any class in this course.`, 400);
    }
  }

  const removed = [...currentIds].filter((id) => !targetIds.has(id));
  const usage = [];
  if (removed.length) {
    const placeholders = removed.map(() => "?").join(",");
    const rows = await all(
      db,
      `SELECT subject_id, COUNT(*) AS n FROM course_catalog
        WHERE parent_id = ? AND subject_id IN (${placeholders}) GROUP BY subject_id`,
      courseId,
      ...removed
    );
    for (const row of rows) {
      if (Number(row.n) > 0) {
        const subject = await first(db, "SELECT name FROM subjects WHERE id=?", row.subject_id);
        usage.push({
          subjectId: row.subject_id,
          subjectName: subject ? subject.name : row.subject_id,
          lectureCount: Number(row.n),
        });
      }
    }
  }
  if (usage.length && force !== true) {
    return {
      conflict: {
        error: "SUBJECT_IN_USE",
        message:
          "Some subjects still have lectures attached. Confirm that those lessons should move to the General group.",
        usage,
      },
    };
  }

  const statements = [];
  for (const subjectId of removed) {
    statements.push(
      db.prepare("DELETE FROM course_subjects WHERE course_id=? AND subject_id=?").bind(courseId, subjectId)
    );
    statements.push(
      db
        .prepare(
          `UPDATE course_catalog
              SET subject_id = NULL,
                  metadata = CASE WHEN json_valid(metadata) THEN json_remove(metadata,'$.subjectId') ELSE metadata END,
                  updated_at = ?
            WHERE parent_id = ? AND subject_id = ?`
        )
        .bind(now(), courseId, subjectId)
    );
  }
  let order = 0;
  for (const subjectId of uniqueIds) {
    if (!currentIds.has(subjectId)) {
      statements.push(
        db
          .prepare(
            "INSERT OR IGNORE INTO course_subjects (course_id,subject_id,sort_order,created_at) VALUES (?,?,?,?)"
          )
          .bind(courseId, subjectId, order, now())
      );
    } else {
      statements.push(
        db
          .prepare("UPDATE course_subjects SET sort_order=? WHERE course_id=? AND subject_id=?")
          .bind(order, courseId, subjectId)
      );
    }
    order += 1;
  }
  await batch(db, statements);
  await activity(db, user, "course_subjects.replace", course.kind, courseId, "Updated subject assignments", {
    subjects: uniqueIds.length,
    movedToGeneral: usage.reduce((sum, item) => sum + item.lectureCount, 0),
  });
  return { items: await adminSubjectList(db, {}) };
}

function subjectPayload(body, current = null) {
  const name = asText(body.name ?? current?.name, 80);
  const description = String(body.description ?? current?.description ?? "").slice(0, 1000);
  const exam = asText(body.exam ?? current?.exam ?? "Both", 10) || "Both";
  const classes = Array.from(
    new Set(
      (Array.isArray(body.classes) ? body.classes : readStringArray(current?.classes, ["11", "12"])).map(
        String
      )
    )
  );
  const active = body.active === undefined ? (current ? asBool(current.active) : true) : body.active === true;
  const archived =
    body.archived === undefined ? (current ? asBool(current.archived) : false) : body.archived === true;
  const sortOrder = Math.max(
    0,
    Math.min(100000, Number(body.sortOrder ?? current?.sort_order ?? 0) || 0)
  );
  if (name.length < 2 || name.length > 80) {
    throw httpError("Subject name must be between 2 and 80 characters.");
  }
  if (!["JEE", "NEET", "Both"].includes(exam)) throw httpError("Choose JEE, NEET or Both.");
  if (!classes.length || classes.some((item) => !["11", "12"].includes(item))) {
    throw httpError("Choose Class 11, Class 12, or both for this subject.");
  }
  return { name, description, exam, classes, active: active && !archived, archived, sortOrder };
}

// ---------------------------------------------------------------------------
// Guarded runtime schema bootstrap
// ---------------------------------------------------------------------------
// Wrangler migrations remain the normal deployment path. This repairs the
// specific recoverable case where a new/empty D1 database is already bound to
// the API but the GitHub deployment token cannot manage D1 migrations. It will
// never run over existing application tables or partially migrate user data.
const RUNTIME_REQUIRED_TABLES = [
  "student_profiles",
  "course_catalog",
  "lesson_progress",
  "exam_attempts",
  "enrollments",
  "enrollment_events",
  "enrollment_rules",
  "announcements",
  "site_settings",
  "admin_activity",
  "student_library",
  "feedback_threads",
  "feedback_messages",
  "notifications",
  "push_tokens",
  "broadcasts",
  "subjects",
  "course_subjects",
  "drive_files",
];

const runtimeSchemaPromises = new WeakMap();

function migrationStatements(sql) {
  // The checked-in migration files use ordinary SQLite statements and line
  // comments (no trigger bodies or semicolons embedded in quoted values).
  return sql
    .replace(/^[ \\t]*--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function initializeRuntimeSchemaIfNeeded(db) {
  const tableRows = await all(
    db,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  );
  let tableNames = new Set(tableRows.map((row) => String(row.name)));
  const appTables = [...tableNames].filter((name) => name !== "d1_migrations");
  const missing = RUNTIME_REQUIRED_TABLES.filter((name) => !tableNames.has(name));

  if (missing.length === 0) return;

  // Empty database only. If any application table exists, don't risk rerunning
  // non-idempotent ALTER TABLE statements against real or partial user data.
  if (appTables.length > 0) {
    throw httpError(
      "Exam Cracker database schema is incomplete.",
      503
    );
  }
  if (typeof db.batch !== "function") {
    throw httpError("Exam Cracker database cannot run schema bootstrap batches.", 503);
  }

  if (!tableNames.has("d1_migrations")) {
    await run(
      db,
      "CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    );
  } else {
    const columns = await all(db, "PRAGMA table_info('d1_migrations')");
    if (!columns.some((column) => column.name === "name")) {
      throw httpError("Exam Cracker D1 migration history table has an unsupported schema.", 503);
    }
    // With no application tables, any old ledger rows cannot describe the
    // missing schema; reset only this metadata table before safely bootstrapping.
    await run(db, "DELETE FROM d1_migrations");
  }

  for (const migration of RUNTIME_MIGRATIONS) {
    const statements = migrationStatements(migration.sql);
    if (!statements.length) continue;
    const prepared = statements.map((sql) => db.prepare(sql));
    prepared.push(db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").bind(migration.name));
    const results = await db.batch(prepared);
    if (Array.isArray(results) && results.some((result) => result && result.success === false)) {
      throw httpError(`Failed to apply D1 schema migration ${migration.name}.`, 503);
    }
  }

  tableNames = new Set(
    (await all(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    )).map((row) => String(row.name))
  );
  const missingAfterBootstrap = RUNTIME_REQUIRED_TABLES.filter((name) => !tableNames.has(name));
  if (missingAfterBootstrap.length) {
    throw httpError(
      `Exam Cracker database bootstrap is incomplete: ${missingAfterBootstrap.join(", ")}.`,
      503
    );
  }
}

function ensureRuntimeSchema(db) {
  let promise = runtimeSchemaPromises.get(db);
  if (!promise) {
    promise = initializeRuntimeSchemaIfNeeded(db).catch((error) => {
      runtimeSchemaPromises.delete(db);
      throw error;
    });
    runtimeSchemaPromises.set(db, promise);
  }
  return promise;
}

// ---------------------------------------------------------------------------
// API handler
// ---------------------------------------------------------------------------

export async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");

  if (origin) {
    let allowed = ALLOWED_ORIGINS.has(origin);
    if (!allowed) {
      try {
        allowed = new URL(origin).hostname.endsWith(".e2b.app");
      } catch {
        allowed = false;
      }
    }
    if (!allowed) return fail("Origin not allowed.", 403);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin || "https://examcrack.pages.dev",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        Vary: "Origin",
      },
    });
  }

  const rawPath = (url.pathname.replace(/^\/api\/ec(?=\/|$)/, "") || "/").replace(/\/+$/, "");
  const path = rawPath || "/";
  const segments = path
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
  const method = request.method.toUpperCase();

  try {
    const db = assertDb(env);
    await ensureRuntimeSchema(db);

    // Public endpoints -----------------------------------------------------
    if (path === "/health" && method === "GET") {
      const result = await first(
        db,
        "SELECT COUNT(*) AS tables_count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );
      return json({
        ok: true,
        service: "Exam Cracker D1 API",
        firebaseProjectId: FIREBASE_PROJECT_ID,
        storage: "cloudflare-d1",
        files: "google-drive",
        tables: Number(result?.tables_count || 0),
      });
    }
    if (path === "/public/site" && method === "GET") {
      const rows = await all(db, "SELECT key,published,published_at FROM site_settings");
      const config = {};
      const publishedAt = {};
      for (const row of rows) {
        config[row.key] = readJson(row.published, {});
        publishedAt[row.key] = row.published_at || null;
      }
      return json({ config, publishedAt, degraded: false });
    }

    const user = await verifyFirebaseToken(request);
    const admin = isAdmin(user);

    // Student profile ------------------------------------------------------
    if (path === "/profile" && method === "GET") {
      return json({ profile: await getProfile(db, user.uid) });
    }
    if (path === "/profile" && (method === "POST" || method === "PATCH")) {
      const body = await readBody(request);
      const displayName = asText(body.displayName || body.display_name || user.name, 80);
      const exam = asText(body.exam, 10).toUpperCase();
      const classLevel = asText(body.classLevel || body.class_level, 2);
      if (displayName.length < 2 || displayName.length > 80) {
        return fail("Name must be 2-80 characters.");
      }
      if (!["JEE", "NEET"].includes(exam) || !["11", "12"].includes(classLevel)) {
        return fail("Choose JEE or NEET and class 11 or 12.");
      }
      const timestamp = now();
      const legacyAvatar = isSafeHttpUrl(user.picture) ? user.picture : null;
      await run(
        db,
        `INSERT INTO student_profiles
           (firebase_uid,display_name,email,exam,class_level,avatar_url,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(firebase_uid) DO UPDATE SET
           display_name=excluded.display_name,
           email=excluded.email,
           exam=excluded.exam,
           class_level=excluded.class_level,
           updated_at=excluded.updated_at`,
        user.uid,
        displayName,
        user.email || null,
        exam,
        classLevel,
        legacyAvatar,
        timestamp,
        timestamp
      );
      return json({ profile: await getProfile(db, user.uid) });
    }

    // Bootstrap ------------------------------------------------------------
    if (path === "/bootstrap" && method === "GET") {
      const profile = await getProfile(db, user.uid);
      if (!profile) {
        return json({ needsOnboarding: true, profile: null, content: [], announcements: [], enrollments: [] });
      }
      const enrollmentRows = await all(
        db,
        "SELECT * FROM enrollments WHERE firebase_uid=? AND active=1 AND status='active' AND (expires_at IS NULL OR expires_at > ?)",
        user.uid,
        now()
      );
      const enrolledIds = new Set(enrollmentRows.map((row) => row.item_id));
      // Bootstrap is the home-screen feed. It must never contain a paid
      // lecture's title just because the item exists in D1, and children of a
      // disabled parent are unavailable even if an old enrollment remains.
      const allVisibleRows = await contentRows(db, {
        activeOnly: true,
        exam: profile.exam,
        classLevel: profile.class_level,
      });
      const activeParentIds = new Set(
        allVisibleRows.filter((item) => ["batch", "series"].includes(item.kind)).map((item) => item.id)
      );
      const content = allVisibleRows
        .filter(visibleBySchedule)
        .filter((item) => {
          if (!["lecture", "resource"].includes(item.kind)) return true;
          if (!item.parentId) return true;
          if (!activeParentIds.has(item.parentId)) return false;
          return isPreviewContent(item) || enrolledIds.has(item.parentId);
        });
      const announcements = (
        await all(db, "SELECT * FROM announcements WHERE active=1 ORDER BY created_at DESC LIMIT 50")
      )
        .filter(
          (item) =>
            (!item.scheduled_at || Date.parse(item.scheduled_at) <= Date.now()) &&
            (item.audience === "All" ||
              item.audience === profile.exam ||
              String(item.audience).includes(profile.class_level))
        )
        .map(mapAnnouncement);
      return json({
        needsOnboarding: false,
        profile,
        content: content.map((item) => mapCourse(item, false)),
        announcements,
        enrollments: enrollmentRows.map((row) => ({ ...row, active: asBool(row.active) })),
      });
    }

    // Subjects visible to the student -------------------------------------
    if (path === "/subjects" && method === "GET") {
      const profile = await getProfile(db, user.uid);
      requireProfile(profile);
      const parentId = url.searchParams.get("parentId") || "";
      let parent = null;
      if (parentId) {
        parent = await courseRow(db, parentId);
        if (!parent || !asBool(parent.active)) return fail("Batch or series not found.", 404);
        if (!["batch", "series"].includes(parent.kind)) return fail("Invalid parent content.", 400);
        if (!profileMatchesCourse(mapCourse(parent, false), profile)) {
          return fail("This content is not available for your exam and class.", 403);
        }
      }
      const rows = parentId
        ? await all(
            db,
            `SELECT s.* FROM subjects s
               JOIN course_subjects cs ON cs.subject_id = s.id
              WHERE cs.course_id = ? AND s.active = 1 AND s.archived = 0
              ORDER BY cs.sort_order, s.sort_order, lower(s.name)`,
            parentId
          )
        : await all(
            db,
            "SELECT * FROM subjects WHERE active=1 AND archived=0 ORDER BY sort_order, lower(name)"
          );
      const filtered = rows.filter(
        (row) =>
          examCompatible(row.exam, parent ? parent.exam : profile.exam) &&
          classOverlap(row.classes, parent ? parent.classes : [profile.class_level])
      );
      const items = [];
      for (const row of filtered) {
        const count = parentId
          ? await first(
              db,
              "SELECT COUNT(*) AS n FROM course_catalog WHERE parent_id=? AND subject_id=? AND active=1",
              parentId,
              row.id
            )
          : await first(
              db,
              "SELECT COUNT(*) AS n FROM course_catalog WHERE subject_id=? AND active=1",
              row.id
            );
        items.push(mapSubject(row, [], Number(count?.n) || 0));
      }
      return json({ items, parent: parent ? mapCourse(parent, false) : null });
    }

    // Course tree: batch/series -> subjects -> lectures/resources -----------
    if (path === "/catalog/tree" && method === "GET") {
      const parentId = url.searchParams.get("parentId") || "";
      if (!parentId) return fail("Choose a batch or series.");
      const parent = await courseRow(db, parentId);
      if (!parent || !asBool(parent.active)) return fail("Batch or series not found.", 404);
      if (!["batch", "series"].includes(parent.kind)) return fail("Invalid parent content.", 400);
      const profile = admin ? await getProfile(db, user.uid) : await getProfile(db, user.uid);
      if (!admin) {
        requireProfile(profile);
        if (!profileMatchesCourse(mapCourse(parent, false), profile)) {
          return fail("This content is not available for your exam and class.", 403);
        }
      }
      const enrolled = admin || (profile ? await hasEnrollment(db, user.uid, parentId) : false);
      const subjectRows = await all(
        db,
        `SELECT s.* FROM subjects s
           JOIN course_subjects cs ON cs.subject_id = s.id
          WHERE cs.course_id = ? AND s.active = 1 AND s.archived = 0
          ORDER BY cs.sort_order, s.sort_order, lower(s.name)`,
        parentId
      );
      const visibleSubjects = subjectRows.filter((row) =>
        examCompatible(row.exam, parent.exam) && classOverlap(row.classes, parent.classes)
      );
      const items = (await contentRows(db, {
        activeOnly: true,
        parentId,
        exam: profile ? profile.exam : parent.exam,
        classLevel: profile ? profile.class_level : null,
      }))
        .filter((item) => ["lecture", "resource"].includes(item.kind))
        .filter(visibleBySchedule)
        .filter((item) => (enrolled ? true : isPreviewContent(item)));

      const bySubject = new Map(
        visibleSubjects.map((row) => [
          row.id,
          { subject: row, lectures: [], resources: [] },
        ])
      );
      const unassigned = { lectures: [], resources: [] };
      for (const item of items) {
        const bucket = item.subjectId ? bySubject.get(item.subjectId) : null;
        const target = bucket || unassigned;
        if (item.kind === "lecture") target.lectures.push(item);
        else target.resources.push(item);
      }
      const subjects = visibleSubjects.map((row) => {
        const group = bySubject.get(row.id);
        return {
          ...mapSubject(row, [], group.lectures.length + group.resources.length),
          lectures: group.lectures,
          resources: group.resources,
        };
      });
      return json({
        parent: mapCourse(parent, false),
        enrolled,
        locked: !enrolled,
        previewCount: items.filter(isPreviewContent).length,
        subjects,
        unassigned:
          unassigned.lectures.length || unassigned.resources.length
            ? { id: null, name: "General", lectures: unassigned.lectures, resources: unassigned.resources }
            : null,
      });
    }

    // Catalogue ------------------------------------------------------------
    if (path === "/content" && method === "GET") {
      const profile = await getProfile(db, user.uid);
      requireProfile(profile);
      const kind = url.searchParams.get("kind") || "";
      const parentId = url.searchParams.get("parentId") || "";
      const subjectId = url.searchParams.get("subjectId") || "";
      let parent = null;
      let enrolled = admin;
      if (parentId) {
        parent = await courseRow(db, parentId);
        if (!parent || !asBool(parent.active)) return fail("Batch or series not found.", 404);
        if (!["batch", "series"].includes(parent.kind)) return fail("Invalid parent content.", 400);
        if (!profileMatchesCourse(mapCourse(parent, false), profile)) {
          return fail("This content is not available for your exam and class.", 403);
        }
        enrolled = admin || (await hasEnrollment(db, user.uid, parentId));
      }
      let items = await contentRows(db, {
        activeOnly: true,
        kind,
        parentId,
        subjectId,
        exam: profile.exam,
        classLevel: profile.class_level,
      });
      items = items.filter(visibleBySchedule);
      if (!parentId) {
        const activeParents = await all(
          db,
          "SELECT id FROM course_catalog WHERE kind IN ('batch','series') AND active=1"
        );
        const activeParentIds = new Set(activeParents.map((row) => String(row.id)));
        items = items.filter((item) => !item.parentId || activeParentIds.has(item.parentId));
      }
      if (["lecture", "resource"].includes(kind) || !kind) {
        const enrollmentRows = await all(
          db,
          "SELECT item_id FROM enrollments WHERE firebase_uid=? AND active=1 AND status='active' AND (expires_at IS NULL OR expires_at > ?)",
          user.uid,
          now()
        );
        const enrolledIds = new Set(enrollmentRows.map((row) => row.item_id));
        if (parentId) {
          items = items.filter((item) => enrolled || isPreviewContent(item));
          if (!enrolled && items.length === 0) {
            return fail("Enroll in this batch or series to access these lessons.", 403);
          }
        } else {
          items = items.filter(
            (item) => !item.parentId || isPreviewContent(item) || enrolledIds.has(item.parentId)
          );
        }
      }
      return json({ items: items.map((item) => mapCourse(item, false)) });
    }

    if (segments[0] === "content" && segments.length === 2 && method === "GET") {
      const row = await courseRow(db, segments[1]);
      if (!row || !asBool(row.active)) return fail("Content not found.", 404);
      const profile = await getProfile(db, user.uid);
      if (!admin) {
        requireProfile(profile);
        if (row.subject_id && !asBool(row.subject_active)) return fail("Content not found.", 404);
        const course = mapCourse(row, false);
        if (!profileMatchesCourse(course, profile)) {
          return fail("This content is not available for your exam and class.", 403);
        }
        if (["lecture", "resource"].includes(row.kind)) {
          if (!(await canAccessCourse(db, user, row, profile, false))) {
            return fail("Enroll in this batch or series to access this lesson.", 403);
          }
        }
      }
      const item = mapCourse(row, false);
      let parent = null;
      if (item.parentId) {
        const parentRow = await courseRow(db, item.parentId);
        if (parentRow && asBool(parentRow.active)) parent = mapCourse(parentRow, false);
      }
      return json({
        item,
        parent,
        subject: item.subjectId ? { id: item.subjectId, name: item.subjectName } : null,
      });
    }

    // Enrollment -----------------------------------------------------------
    if (path === "/enrollments" && method === "POST") {
      const profile = await getProfile(db, user.uid);
      requireProfile(profile);
      const body = await readBody(request);
      const itemType = body.itemType === "series" ? "series" : "batch";
      const itemId = asText(body.itemId, 120);
      const item = await courseRow(db, itemId);
      if (!item || item.kind !== itemType || !asBool(item.active)) {
        return fail("This batch or series is unavailable.", 404);
      }
      const course = mapCourse(item, true);
      const metadata = course.metadata || {};
      const needsCode = Boolean(
        item.access_code || metadata.requiresAccessCode || metadata.paid === true || metadata.isPaid === true
      );
      if (needsCode && String(body.accessCode || "") !== String(item.access_code || "")) {
        return fail("This content requires a valid access code or admin grant.", 402);
      }
      if (!profileMatchesCourse(course, profile)) {
        return fail("This content is not available for your exam and class.", 403);
      }
      const timestamp = now();
      await run(
        db,
        `INSERT INTO enrollments
           (id,firebase_uid,item_type,item_id,active,status,source,metadata,created_at,updated_at)
         VALUES (?,?,?,?,1,'active',?,?,?,?)
         ON CONFLICT(firebase_uid,item_type,item_id) DO UPDATE SET
           active=1,status='active',source=excluded.source,revoked_at=NULL,updated_at=excluded.updated_at`,
        uuid(),
        user.uid,
        itemType,
        itemId,
        body.accessCode ? "access_code" : "self_service",
        "{}",
        timestamp,
        timestamp
      );
      const enrollment = await first(
        db,
        "SELECT * FROM enrollments WHERE firebase_uid=? AND item_type=? AND item_id=?",
        user.uid,
        itemType,
        itemId
      );
      await run(
        db,
        "INSERT INTO enrollment_events (id,enrollment_id,firebase_uid,item_type,item_id,action,source,actor_uid,actor_email,detail,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        uuid(),
        enrollment.id,
        user.uid,
        itemType,
        itemId,
        "granted",
        body.accessCode ? "access_code" : "self_service",
        user.uid,
        user.email,
        "{}",
        timestamp
      );
      return json({ enrolled: true, enrollment: { ...enrollment, active: asBool(enrollment.active) } });
    }

    // Progress -------------------------------------------------------------
    if (path === "/progress" && method === "POST") {
      const profile = await getProfile(db, user.uid);
      requireProfile(profile);
      const body = await readBody(request);
      const lectureId = asText(body.lectureId, 120);
      if (!lectureId) return fail("Lecture is required.");
      const lecture = await courseRow(db, lectureId);
      if (!lecture || !asBool(lecture.active) || !["lecture", "resource"].includes(lecture.kind)) {
        return fail("Lecture not found.", 404);
      }
      if (!(await canAccessCourse(db, user, lecture, profile, false))) {
        return fail("You do not have access to this lecture.", 403);
      }
      const watched = Math.max(0, Math.min(86400, Math.round(Number(body.watchedSeconds) || 0)));
      const completed = body.completed === true ? 1 : 0;
      await run(
        db,
        `INSERT INTO lesson_progress (id,firebase_uid,lecture_id,watched_seconds,completed,updated_at)
         VALUES (?,?,?,?,?,?)
         ON CONFLICT(firebase_uid,lecture_id) DO UPDATE SET
           watched_seconds=MAX(lesson_progress.watched_seconds,excluded.watched_seconds),
           completed=MAX(lesson_progress.completed,excluded.completed),
           updated_at=excluded.updated_at`,
        uuid(),
        user.uid,
        lectureId,
        watched,
        completed,
        now()
      );
      const row = await first(
        db,
        "SELECT * FROM lesson_progress WHERE firebase_uid=? AND lecture_id=?",
        user.uid,
        lectureId
      );
      return json({ progress: { ...row, completed: asBool(row.completed) } });
    }

    // Tests ----------------------------------------------------------------
    if (path === "/tests" && method === "GET") {
      const profile = await getProfile(db, user.uid);
      requireProfile(profile);
      const rows = await contentRows(db, {
        activeOnly: true,
        kind: "test",
        exam: profile.exam,
        classLevel: profile.class_level,
      });
      return json({ items: rows.filter(visibleBySchedule).map(mapTestCard) });
    }

    if (segments[0] === "tests" && segments.length === 2 && method === "GET") {
      const profile = await getProfile(db, user.uid);
      requireProfile(profile);
      const row = await courseRow(db, segments[1]);
      if (!row || row.kind !== "test" || !asBool(row.active)) return fail("Test not found.", 404);
      const test = mapCourse(row, true);
      if (!profileMatchesCourse(test, profile)) {
        return fail("Test is not available for your exam and class.", 403);
      }
      const prior = await first(
        db,
        "SELECT id FROM exam_attempts WHERE firebase_uid=? AND test_id=? ORDER BY submitted_at DESC LIMIT 1",
        user.uid,
        test.id
      );
      if (prior) return fail("You have already submitted this test.", 409);
      if (!visibleBySchedule(test)) return fail("This test is not open for submissions.", 409);
      const questions = Array.isArray(test.metadata.questions)
        ? test.metadata.questions.map(redactQuestion)
        : [];
      return json({ test: mapTestCard(row), questions });
    }

    if (segments[0] === "tests" && segments.length === 3 && segments[2] === "submit" && method === "POST") {
      const profile = await getProfile(db, user.uid);
      requireProfile(profile);
      const testId = segments[1];
      const body = await readBody(request);
      const row = await courseRow(db, testId);
      if (!row || row.kind !== "test" || !asBool(row.active)) return fail("Test not found.", 404);
      const test = mapCourse(row, true);
      if (!profileMatchesCourse(test, profile)) {
        return fail("Test is not available for your exam and class.", 403);
      }
      const prior = await first(
        db,
        "SELECT id FROM exam_attempts WHERE firebase_uid=? AND test_id=? LIMIT 1",
        user.uid,
        testId
      );
      if (prior) return fail("This test has already been submitted.", 409);
      if (!visibleBySchedule(test)) return fail("This test is not open for submissions.", 409);
      const result = scoreTest(
        test,
        body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
          ? body.answers
          : {}
      );
      const reviewPayload = result.review.map(mapReviewItem);
      const attemptId = uuid();
      const timestamp = now();
      await run(
        db,
        `INSERT INTO exam_attempts
           (id,firebase_uid,test_id,exam,class_level,score,max_score,correct_count,
            incorrect_count,unanswered_count,answers,submitted_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        attemptId,
        user.uid,
        testId,
        profile.exam,
        profile.class_level,
        result.score,
        result.maxScore,
        result.correct,
        result.incorrect,
        result.unanswered,
        JSON.stringify({ submitted: body.answers || {}, review: reviewPayload }),
        timestamp
      );
      const attempt = parseAttempt(await first(db, "SELECT * FROM exam_attempts WHERE id=?", attemptId));
      return json({
        attempt,
        result: {
          score: result.score,
          maxScore: result.maxScore,
          correct: result.correct,
          incorrect: result.incorrect,
          unanswered: result.unanswered,
          percentage: result.percentage,
          totalQuestions: result.questionsCount,
        },
        review: reviewPayload,
      });
    }

    if (segments[0] === "tests" && segments.length === 3 && segments[2] === "result" && method === "GET") {
      const testId = segments[1];
      const attempt = parseAttempt(
        await first(
          db,
          "SELECT * FROM exam_attempts WHERE firebase_uid=? AND test_id=? ORDER BY submitted_at DESC LIMIT 1",
          user.uid,
          testId
        )
      );
      if (!attempt) return fail("No submitted result was found.", 404);
      const saved = attempt.answers && typeof attempt.answers === "object" ? attempt.answers : {};
      const review = Array.isArray(saved.review) ? saved.review.map(mapReviewItem) : [];
      const percentage = attempt.max_score > 0 ? (Math.max(0, attempt.score) / attempt.max_score) * 100 : 0;
      return json({
        attempt,
        result: {
          score: attempt.score,
          maxScore: attempt.max_score,
          correct: attempt.correct_count,
          incorrect: attempt.incorrect_count,
          unanswered: attempt.unanswered_count,
          percentage,
          totalQuestions: review.length,
        },
        review,
      });
    }

    // Leaderboard ----------------------------------------------------------
    if (path === "/leaderboard" && method === "GET") {
      const testId = url.searchParams.get("testId") || "";
      if (!testId) return json({ testId: null, items: [] });
      const profile = admin ? null : await getProfile(db, user.uid);
      if (!admin) requireProfile(profile);
      const params = [];
      let where = "WHERE e.test_id=?";
      params.push(testId);
      if (!admin) {
        where += " AND e.exam=? AND e.class_level=?";
        params.push(profile.exam, profile.class_level);
      }
      const rows = await all(
        db,
        `SELECT e.firebase_uid,e.score,e.max_score,e.correct_count,e.submitted_at,
                p.display_name,p.avatar_file_id
           FROM exam_attempts e
           LEFT JOIN student_profiles p ON p.firebase_uid=e.firebase_uid
           ${where}
          ORDER BY e.score DESC, e.submitted_at ASC
          LIMIT 100`,
        ...params
      );
      return json({
        testId,
        items: rows.map((item, index) => ({
          rank: index + 1,
          testId,
          firebaseUid: item.firebase_uid,
          name:
            item.firebase_uid === user.uid
              ? profile?.display_name || "You"
              : item.display_name || "Student",
          avatarUrl: item.avatar_file_id
            ? `/api/ec/files/${encodeURIComponent(item.avatar_file_id)}`
            : null,
          score: Number(item.score) || 0,
          maxScore: Number(item.max_score) || 0,
          submittedAt: item.submitted_at,
          isCurrentUser: item.firebase_uid === user.uid,
        })),
      });
    }

    // Student analysis -----------------------------------------------------
    if (path === "/analysis" && method === "GET") {
      const profile = await getProfile(db, user.uid);
      requireProfile(profile);
      const attempts = (
        await all(
          db,
          "SELECT * FROM exam_attempts WHERE firebase_uid=? ORDER BY submitted_at DESC LIMIT 100",
          user.uid
        )
      ).map(parseAttempt);
      const progressRows = await all(
        db,
        "SELECT * FROM lesson_progress WHERE firebase_uid=? ORDER BY updated_at DESC",
        user.uid
      );
      const progress = progressRows.map((row) => ({ ...row, completed: asBool(row.completed) }));
      const totalScore = attempts.reduce((sum, item) => sum + Number(item.score || 0), 0);
      const totalMaxScore = attempts.reduce((sum, item) => sum + Number(item.max_score || 0), 0);
      const watchedSeconds = progress.reduce((sum, item) => sum + Number(item.watched_seconds || 0), 0);
      const completedLessons = progress.filter((item) => item.completed).length;
      return json({
        profile,
        level: attempts.length < 3 ? "Beginner" : attempts.length < 10 ? "Consistent" : "Dedicated",
        testsTaken: attempts.length,
        averagePercentage: totalMaxScore > 0 ? (Math.max(0, totalScore) / totalMaxScore) * 100 : 0,
        totalScore,
        totalMaxScore,
        completedLessons,
        watchedSeconds,
        attempts,
        lessonProgress: progress,
        // Backwards-compatible aggregates retained for older UI builds.
        counts: {
          testsTaken: attempts.length,
          lessonsStarted: progress.length,
          lessonsCompleted: completedLessons,
          watchSeconds: watchedSeconds,
        },
        stats: {
          testsTaken: attempts.length,
          averageScore: attempts.length ? totalScore / attempts.length : 0,
          totalScore,
          watchSeconds: watchedSeconds,
        },
      });
    }

    // Feedback (student) ---------------------------------------------------
    if (segments[0] === "feedback") {
      const threadId = segments[1] || "";
      if (method === "GET" && !threadId) {
        return json({ items: await listStudentFeedback(db, user.uid) });
      }
      if (method === "POST" && !threadId) {
        const body = await readBody(request);
        const messageText = asText(body.message || body.text, 5000);
        const subject = asText(body.subject, 160) || "Student feedback";
        const category = FEEDBACK_CATEGORIES.has(String(body.category))
          ? String(body.category)
          : "general";
        if (messageText.length < 3 || messageText.length > 5000) {
          return fail("Feedback must be between 3 and 5000 characters.");
        }
        if (subject.length < 3) return fail("Add a short subject for your feedback.");
        const timestamp = now();
        const id = uuid();
        await run(
          db,
          `INSERT INTO feedback_threads
             (id,firebase_uid,category,subject,status,last_message_text,last_message_at,
              unread_by_admin,unread_by_student,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          id,
          user.uid,
          category,
          subject,
          "open",
          messageText.slice(0, 200),
          timestamp,
          1,
          0,
          timestamp,
          timestamp
        );
        await run(
          db,
          "INSERT INTO feedback_messages (id,thread_id,sender_uid,sender_role,text,created_at,is_read,payload) VALUES (?,?,?,?,?,?,0,?)",
          uuid(),
          id,
          user.uid,
          "student",
          messageText,
          timestamp,
          JSON.stringify({
            attachments: Array.isArray(body.attachments) ? body.attachments.slice(0, 5) : [],
          })
        );
        return json({ item: mapFeedbackThread(await first(db, "SELECT * FROM feedback_threads WHERE id=?", id)) }, 201);
      }
      if (method === "GET" && threadId) {
        const thread = await first(
          db,
          "SELECT * FROM feedback_threads WHERE id=? AND firebase_uid=?",
          threadId,
          user.uid
        );
        if (!thread) return fail("Feedback item not found.", 404);
        await run(
          db,
          "UPDATE feedback_messages SET is_read=1,read_at=? WHERE thread_id=? AND sender_role='admin' AND is_read=0",
          now(),
          threadId
        );
        await run(db, "UPDATE feedback_threads SET unread_by_student=0 WHERE id=?", threadId);
        return json({ item: mapFeedbackThread(thread), messages: await listFeedbackMessages(db, threadId) });
      }
      if (method === "POST" && threadId && segments[2] === "messages") {
        const thread = await first(
          db,
          "SELECT * FROM feedback_threads WHERE id=? AND firebase_uid=?",
          threadId,
          user.uid
        );
        if (!thread) return fail("Feedback item not found.", 404);
        const body = await readBody(request);
        const text = asText(body.message || body.text, 5000);
        if (text.length < 1) return fail("Message cannot be empty.");
        const timestamp = now();
        await run(
          db,
          "INSERT INTO feedback_messages (id,thread_id,sender_uid,sender_role,text,created_at,is_read,payload) VALUES (?,?,?,?,?,?,0,?)",
          uuid(),
          threadId,
          user.uid,
          "student",
          text,
          timestamp,
          "{}"
        );
        await run(
          db,
          `UPDATE feedback_threads
              SET status=CASE WHEN status='resolved' THEN 'open' ELSE status END,
                  resolved_at=CASE WHEN status='resolved' THEN NULL ELSE resolved_at END,
                  last_message_text=?,last_message_at=?,unread_by_admin=1,updated_at=?
            WHERE id=?`,
          text.slice(0, 200),
          timestamp,
          timestamp,
          threadId
        );
        return json({ messages: await listFeedbackMessages(db, threadId) }, 201);
      }
    }

    // Notifications --------------------------------------------------------
    if (path === "/notifications" && method === "GET") {
      const rows = await all(
        db,
        "SELECT * FROM notifications WHERE firebase_uid=? ORDER BY created_at DESC LIMIT 100",
        user.uid
      );
      return json({
        items: rows.map((row) => ({
          id: row.id,
          ...readJson(row.payload, {}),
          createdAt: row.created_at,
          isRead: asBool(row.is_read),
          readAt: row.read_at || null,
        })),
      });
    }
    if (segments[0] === "notifications" && segments.length === 2 && method === "PATCH") {
      await run(
        db,
        "UPDATE notifications SET is_read=1,read_at=? WHERE id=? AND firebase_uid=?",
        now(),
        segments[1],
        user.uid
      );
      return json({ updated: true });
    }
    if (path === "/broadcasts" && method === "GET") {
      const profile = await getProfile(db, user.uid);
      const rows = await all(db, "SELECT * FROM broadcasts WHERE active=1 ORDER BY created_at DESC LIMIT 50");
      return json({
        items: rows
          .map((row) => ({ id: row.id, ...readJson(row.payload, {}), active: true, createdAt: row.created_at }))
          .filter(
            (item) =>
              !profile ||
              ((!item.exam || item.exam === "Both" || item.exam === profile.exam) &&
                (!item.classes || item.classes.includes(profile.class_level)))
          ),
      });
    }
    if (path === "/push-tokens" && method === "POST") {
      const body = await readBody(request);
      const token = asText(body.token, 4096);
      if (!token) return fail("Invalid push token.");
      await run(
        db,
        "INSERT INTO push_tokens (id,firebase_uid,token,created_at,payload) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET token=excluded.token,created_at=excluded.created_at,payload=excluded.payload",
        `${user.uid}:${token.slice(0, 40)}`,
        user.uid,
        token,
        now(),
        JSON.stringify({ platform: body.platform || "web" })
      );
      return json({ saved: true });
    }

    // Personal library -----------------------------------------------------
    if (path === "/library" && method === "GET") {
      const rows = await all(
        db,
        "SELECT * FROM student_library WHERE firebase_uid=? ORDER BY updated_at DESC LIMIT 300",
        user.uid
      );
      return json({
        items: rows.map((row) => ({ ...row, payload: readJson(row.payload, {}) })),
      });
    }
    if (path === "/library" && method === "POST") {
      const body = await readBody(request);
      const itemType = String(body.itemType || "");
      const itemId = asText(body.itemId, 240);
      if (!LIBRARY_TYPES.has(itemType) || !itemId) return fail("Invalid library item.");
      const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
      if (JSON.stringify(payload).length > 100 * 1024) return fail("Library item is too large.", 413);
      await run(
        db,
        `INSERT INTO student_library (id,firebase_uid,item_type,item_id,payload,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(firebase_uid,item_type,item_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`,
        uuid(),
        user.uid,
        itemType,
        itemId,
        JSON.stringify(payload),
        now(),
        now()
      );
      const row = await first(
        db,
        "SELECT * FROM student_library WHERE firebase_uid=? AND item_type=? AND item_id=?",
        user.uid,
        itemType,
        itemId
      );
      return json({ item: { ...row, payload: readJson(row.payload, {}) } });
    }
    if (segments[0] === "library" && segments.length === 3 && method === "DELETE") {
      await run(
        db,
        "DELETE FROM student_library WHERE firebase_uid=? AND item_type=? AND item_id=?",
        user.uid,
        segments[1],
        segments[2]
      );
      return json({ removed: true });
    }

    // Google Drive: current student's profile photo ------------------------
    if (path === "/drive/profile-photo" && method === "GET") {
      const profile = await getProfile(db, user.uid);
      requireProfile(profile);
      if (!profile.avatar_file_id) return json({ file: null });
      const row = await first(db, "SELECT * FROM drive_files WHERE id=? AND status='active'", profile.avatar_file_id);
      return json({ file: mapDriveFile(row) });
    }
    if (path === "/drive/profile-photo" && method === "POST") {
      const profile = await getProfile(db, user.uid);
      requireProfile(profile);
      const limit = maxUploadBytes(env, "GOOGLE_DRIVE_MAX_PROFILE_PHOTO_MB", 5);
      const { value, bytes } = await readMultipartFile(request, limit);
      const detected = detectProfilePhoto(bytes);
      if (!detected) {
        return fail("Profile photos must be a JPEG, PNG or WebP image. The file contents did not match those formats.", 415);
      }
      const displayName = safeDisplayName(value.name, "Profile photo");
      const previous = profile.avatar_file_id
        ? await first(db, "SELECT * FROM drive_files WHERE id=?", profile.avatar_file_id)
        : null;

      let uploaded;
      try {
        uploaded = await uploadDriveFile(env, {
          bytes,
          mimeType: detected.mimeType,
          name: `ec-profile-${uuid()}.${detected.extension}`,
          purpose: "profile_photo",
        });
      } catch (error) {
        const status = Number(error && error.status) || 502;
        return fail(error instanceof Error ? error.message : "Google Drive upload failed.", status);
      }

      const recordId = uuid();
      let inserted = false;
      try {
        await run(
          db,
          `INSERT INTO drive_files
             (id,drive_file_id,owner_uid,uploader_uid,purpose,course_id,subject_id,
              mime_type,display_name,size_bytes,status,visibility,created_at,updated_at)
           VALUES (?,?,?,?,?,NULL,NULL,?,?,?,?,?,?,?)`,
          recordId,
          uploaded.id,
          user.uid,
          user.uid,
          "profile_photo",
          detected.mimeType,
          displayName,
          bytes.length,
          "active",
          "authenticated",
          now(),
          now()
        );
        inserted = true;
        const updated = await run(
          db,
          "UPDATE student_profiles SET avatar_file_id=?,updated_at=? WHERE firebase_uid=?",
          recordId,
          now(),
          user.uid
        );
        if (Number(updated?.meta?.changes || 0) === 0) {
          throw new Error("Profile update did not touch a row.");
        }
      } catch {
        if (!inserted) {
          try {
            await deleteDriveFile(env, uploaded.id);
          } catch {
            // The upload row was never created. Report failure; no false success.
          }
          return fail("The profile photo could not be saved. Please retry.", 500);
        }
        // The upload row exists but the profile reference failed. Try to clean
        // both up; leave an orphan marker only if Drive deletion also fails.
        let driveDeleted = false;
        try {
          driveDeleted = await deleteDriveFile(env, uploaded.id);
        } catch {
          driveDeleted = false;
        }
        try {
          if (driveDeleted) {
            await run(db, "DELETE FROM drive_files WHERE id=?", recordId);
          } else {
            await run(db, "UPDATE drive_files SET status='orphan',updated_at=? WHERE id=?", now(), recordId);
          }
        } catch {
          // The original safe failure is still reported.
        }
        return fail("The profile photo could not be saved. Your previous photo is unchanged.", 500);
      }

      const warnings = [];
      if (previous && previous.id !== recordId) {
        await run(
          db,
          "UPDATE drive_files SET status='superseded',updated_at=?,deleted_at=? WHERE id=?",
          now(),
          now(),
          previous.id
        );
        try {
          const deleted = await deleteDriveFile(env, previous.drive_file_id);
          if (!deleted) warnings.push("The previous photo will be cleaned up by the admin cleanup tool.");
        } catch {
          warnings.push("The previous photo will be cleaned up by the admin cleanup tool.");
        }
      }

      const nextProfile = await getProfile(db, user.uid);
      const fileRow = await first(
        db,
        `SELECT d.*, c.title AS course_title FROM drive_files d
           LEFT JOIN course_catalog c ON c.id=d.course_id WHERE d.id=?`,
        recordId
      );
      return json({ file: mapDriveFile(fileRow), profile: nextProfile, warnings }, 201);
    }

    // Google Drive: authorized file reading --------------------------------
    if (path === "/files" && method === "GET") {
      const courseId = url.searchParams.get("courseId") || "";
      if (!courseId) return fail("courseId is required.");
      const course = await courseRow(db, courseId);
      if (!course || !asBool(course.active)) return fail("Course not found.", 404);
      const profile = await getProfile(db, user.uid);
      if (!admin) {
        requireProfile(profile);
        if (!(await canAccessCourseFiles(db, user, course, profile))) {
          return fail("Enroll in this course to open its files.", 403);
        }
      }
      const rows = await all(
        db,
        `SELECT d.*, c.title AS course_title
           FROM drive_files d LEFT JOIN course_catalog c ON c.id=d.course_id
          WHERE d.course_id=? AND d.purpose='pdf' AND d.status='active'
          ORDER BY d.created_at DESC`,
        courseId
      );
      return json({ items: rows.map(mapDriveFile) });
    }

    if (segments[0] === "files" && segments.length === 2 && method === "GET") {
      const row = await authorizedFileRow(db, user, segments[1]);
      let driveResponse;
      try {
        driveResponse = await downloadDriveFile(env, row.drive_file_id);
      } catch (error) {
        const status = Number(error && error.status) || 502;
        return fail(error instanceof Error ? error.message : "File download failed.", status);
      }
      const headers = new Headers();
      headers.set("Content-Type", row.mime_type);
      headers.set("Content-Disposition", contentDisposition(row.display_name, url.searchParams.get("download") === "1"));
      headers.set("Cache-Control", "private, max-age=60");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("X-Frame-Options", "SAMEORIGIN");
      headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'self'");
      if (Number(row.size_bytes) > 0) headers.set("Content-Length", String(row.size_bytes));
      return new Response(driveResponse.body, { status: 200, headers });
    }

    // ---------------------------------------------------------------------
    // Admin routes
    // ---------------------------------------------------------------------
    if (segments[0] === "admin") {
      requireAdmin(user);

      if (path === "/admin/overview" && method === "GET") {
        const counts = {};
        for (const [key, table, where] of [
          ["students", "student_profiles", ""],
          ["content", "course_catalog", ""],
          ["active_content", "course_catalog", " WHERE active=1"],
          ["tests", "course_catalog", " WHERE kind='test'"],
          ["announcements", "announcements", ""],
          ["attempts", "exam_attempts", ""],
          ["enrollments", "enrollments", " WHERE active=1"],
          ["feedback", "feedback_threads", " WHERE status!='resolved'"],
          ["subjects", "subjects", " WHERE archived=0"],
          ["drive_files", "drive_files", " WHERE status='active'"],
        ]) {
          counts[key] = Number((await first(db, `SELECT COUNT(*) AS n FROM ${table}${where}`))?.n || 0);
        }
        const latestContent = (
          await all(
            db,
            `SELECT c.*, s.name AS subject_name FROM course_catalog c
               LEFT JOIN subjects s ON s.id=c.subject_id
              ORDER BY c.created_at DESC LIMIT 8`
          )
        ).map((row) => mapCourse(row, true));
        const latestActivity = await all(
          db,
          "SELECT * FROM admin_activity ORDER BY created_at DESC LIMIT 8"
        );
        return json({ counts, latestContent, latestActivity });
      }

      if (segments[1] === "students" && method === "GET") {
        const q = (url.searchParams.get("query") || "").trim().toLowerCase();
        const exam = url.searchParams.get("exam") || "";
        const classLevel = url.searchParams.get("class") || "";
        const page = Math.max(1, Number(url.searchParams.get("page") || 1));
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 25)));
        let items = await all(db, "SELECT * FROM student_profiles ORDER BY created_at DESC");
        items = items
          .map(mapProfile)
          .filter(
            (item) =>
              (!q ||
                String(item.display_name || "").toLowerCase().includes(q) ||
                String(item.email || "").toLowerCase().includes(q) ||
                item.firebase_uid.toLowerCase().includes(q)) &&
              (!exam || item.exam === exam) &&
              (!classLevel || item.class_level === classLevel)
          );
        return json({
          items: items.slice((page - 1) * pageSize, page * pageSize),
          total: items.length,
          page,
          pageSize,
          totalPages: Math.ceil(items.length / pageSize),
        });
      }

      // Subjects CRUD ------------------------------------------------------
      if (path === "/admin/subjects" && method === "GET") {
        const items = await adminSubjectList(db, {
          query: url.searchParams.get("query") || "",
          exam: url.searchParams.get("exam") || "",
          classLevel: url.searchParams.get("class") || "",
          includeArchived: url.searchParams.get("includeArchived") !== "0",
        });
        return json({ items });
      }
      if (path === "/admin/subjects" && method === "POST") {
        const payload = subjectPayload(await readBody(request));
        const id = uuid();
        const timestamp = now();
        try {
          await run(
            db,
            `INSERT INTO subjects
               (id,name,description,exam,classes,active,archived,sort_order,created_at,updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            id,
            payload.name,
            payload.description,
            payload.exam,
            JSON.stringify(payload.classes),
            payload.active ? 1 : 0,
            payload.archived ? 1 : 0,
            payload.sortOrder,
            timestamp,
            timestamp
          );
        } catch (error) {
          const message = String(error && error.message || "");
          if (/unique/i.test(message)) {
            return fail("A subject with this name and exam track already exists.", 409);
          }
          throw error;
        }
        await activity(db, user, "subject.create", "subject", id, payload.name, { exam: payload.exam });
        const row = await first(db, "SELECT * FROM subjects WHERE id=?", id);
        return json({ item: mapSubject(row) }, 201);
      }
      if (segments[1] === "subjects" && segments.length === 3 && (method === "PATCH" || method === "DELETE")) {
        const id = segments[2];
        const current = await first(db, "SELECT * FROM subjects WHERE id=?", id);
        if (!current) return fail("Subject not found.", 404);
        if (method === "DELETE") {
          await run(db, "UPDATE subjects SET archived=1,active=0,updated_at=? WHERE id=?", now(), id);
          await activity(db, user, "subject.archive", "subject", id, current.name);
          const row = await first(db, "SELECT * FROM subjects WHERE id=?", id);
          return json({ item: mapSubject(row), archived: true });
        }
        const payload = subjectPayload(await readBody(request), current);
        try {
          await run(
            db,
            `UPDATE subjects
                SET name=?,description=?,exam=?,classes=?,active=?,archived=?,sort_order=?,updated_at=?
              WHERE id=?`,
            payload.name,
            payload.description,
            payload.exam,
            JSON.stringify(payload.classes),
            payload.active ? 1 : 0,
            payload.archived ? 1 : 0,
            payload.sortOrder,
            now(),
            id
          );
        } catch (error) {
          const message = String(error && error.message || "");
          if (/unique/i.test(message)) {
            return fail("A subject with this name and exam track already exists.", 409);
          }
          throw error;
        }
        await activity(db, user, "subject.update", "subject", id, payload.name);
        const row = await first(db, "SELECT * FROM subjects WHERE id=?", id);
        return json({ item: mapSubject(row) });
      }

      // Subject assignments ------------------------------------------------
      if (path === "/admin/course-subjects" && method === "POST") {
        const body = await readBody(request);
        const result = await replaceCourseSubjects(
          db,
          user,
          asText(body.courseId, 120),
          Array.isArray(body.subjectIds) ? body.subjectIds : [],
          body.force === true
        );
        if (result.conflict) return json(result.conflict, 409);
        return json(result);
      }
      if (segments[1] === "course-subjects" && segments.length === 4 && method === "DELETE") {
        const courseId = segments[2];
        const subjectId = segments[3];
        const current = await all(db, "SELECT subject_id FROM course_subjects WHERE course_id=?", courseId);
        const next = current
          .map((row) => row.subject_id)
          .filter((id) => id !== subjectId);
        const result = await replaceCourseSubjects(
          db,
          user,
          courseId,
          next,
          url.searchParams.get("force") === "1"
        );
        if (result.conflict) return json(result.conflict, 409);
        return json(result);
      }

      // Content CRUD -------------------------------------------------------
      if (path === "/admin/content" && method === "GET") {
        const items = await contentRows(db, {
          kind: url.searchParams.get("kind") || "",
          exam: url.searchParams.get("exam") || "",
          classLevel: url.searchParams.get("class") || "",
          parentId: url.searchParams.get("parentId") || "",
          subjectId: url.searchParams.get("subjectId") || "",
        });
        const hydrated = [];
        for (const item of items) {
          const row = await courseRow(db, item.id);
          hydrated.push(mapCourse(row, true));
        }
        return json({ items: hydrated });
      }
      if (path === "/admin/content" && method === "POST") {
        const payload = coursePayload(await readBody(request));
        const relations = await validateCourseRelations(
          db,
          payload.kind,
          payload.parentId,
          payload.subjectId
        );
        const id = uuid();
        const metadata = withRelationMetadata(payload, relations);
        const timestamp = now();
        await run(
          db,
          `INSERT INTO course_catalog
             (id,kind,title,description,exam,classes,active,access_code,metadata,
              parent_id,subject_id,sort_order,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          id,
          payload.kind,
          payload.title,
          payload.description,
          payload.exam,
          JSON.stringify(payload.classes),
          payload.active ? 1 : 0,
          payload.accessCode,
          JSON.stringify(metadata),
          relations.parentId,
          relations.subjectId,
          payload.sortOrder,
          timestamp,
          timestamp
        );
        await activity(db, user, "content.create", payload.kind, id, payload.title, {
          exam: payload.exam,
          parentId: relations.parentId,
          subjectId: relations.subjectId,
        });
        return json({ item: mapCourse(await courseRow(db, id), true) }, 201);
      }
      if (segments[1] === "content" && segments.length === 3 && (method === "PATCH" || method === "DELETE")) {
        const id = segments[2];
        const currentRow = await courseRow(db, id);
        if (!currentRow) return fail("Content not found.", 404);
        if (method === "DELETE") {
          if (url.searchParams.get("permanent") === "1") {
            if (asBool(currentRow.active)) {
              return fail("Disable this item before permanently deleting it.", 409);
            }
            const dependencies = {};
            const addCount = async (key, sql, ...values) => {
              const result = await first(db, sql, ...values);
              const count = Number(result?.n) || 0;
              if (count > 0) dependencies[key] = count;
            };
            if (["batch", "series"].includes(currentRow.kind)) {
              await addCount(
                "childContent",
                `SELECT COUNT(*) AS n FROM course_catalog c
                  WHERE c.parent_id=? OR
                    (json_valid(c.metadata) AND COALESCE(
                      json_extract(c.metadata,'$.parentId'),
                      json_extract(c.metadata,'$.parent_id'),
                      json_extract(c.metadata,'$.batchId'),
                      json_extract(c.metadata,'$.seriesId')
                    )=?)`,
                id,
                id
              );
              await addCount("enrollments", "SELECT COUNT(*) AS n FROM enrollments WHERE item_id=?", id);
              await addCount(
                "lessonProgress",
                `SELECT COUNT(*) AS n FROM lesson_progress p
                   JOIN course_catalog c ON c.id=p.lecture_id
                  WHERE c.parent_id=? OR (json_valid(c.metadata) AND COALESCE(
                    json_extract(c.metadata,'$.parentId'), json_extract(c.metadata,'$.parent_id'),
                    json_extract(c.metadata,'$.batchId'), json_extract(c.metadata,'$.seriesId')
                  )=?)`,
                id,
                id
              );
              await addCount("subjectAssignments", "SELECT COUNT(*) AS n FROM course_subjects WHERE course_id=?", id);
              await addCount("studentReferences", "SELECT COUNT(*) AS n FROM student_library WHERE item_id=?", id);
              await addCount("storedFiles", "SELECT COUNT(*) AS n FROM drive_files WHERE course_id=? AND status!='deleted'", id);
            } else {
              if (currentRow.kind === "lecture" || currentRow.kind === "resource") {
                await addCount("lessonProgress", "SELECT COUNT(*) AS n FROM lesson_progress WHERE lecture_id=?", id);
              }
              if (currentRow.kind === "test") {
                await addCount("testAttempts", "SELECT COUNT(*) AS n FROM exam_attempts WHERE test_id=?", id);
              }
              await addCount("studentReferences", "SELECT COUNT(*) AS n FROM student_library WHERE item_id=?", id);
              const metadata = readJson(currentRow.metadata, {});
              await addCount(
                "storedFiles",
                "SELECT COUNT(*) AS n FROM drive_files WHERE status!='deleted' AND (course_id=? OR id=?)",
                id,
                String(metadata.notesFileId || "__no_file__")
              );
            }
            if (Object.keys(dependencies).length) {
              return json({
                error: "CONTENT_HAS_DEPENDENCIES",
                detail: "This item has saved relationships or student records. Remove or safely reassign them before permanent deletion.",
                dependencies,
              }, 409);
            }
            // Recheck dependencies in the DELETE predicate itself. If a student
            // record or child arrives after the diagnostic reads above, do not
            // race into deleting the parent and orphaning that record.
            const safeDeleteChecks = ["active=0"];
            const safeDeleteValues = [];
            const addSafeDeleteCheck = (sql, ...values) => {
              safeDeleteChecks.push(`NOT EXISTS (${sql})`);
              safeDeleteValues.push(...values);
            };
            if (["batch", "series"].includes(currentRow.kind)) {
              addSafeDeleteCheck(
                `SELECT 1 FROM course_catalog c WHERE c.parent_id=? OR
                  (json_valid(c.metadata) AND COALESCE(
                    json_extract(c.metadata,'$.parentId'), json_extract(c.metadata,'$.parent_id'),
                    json_extract(c.metadata,'$.batchId'), json_extract(c.metadata,'$.seriesId')
                  )=?)`,
                id,
                id
              );
              addSafeDeleteCheck("SELECT 1 FROM enrollments WHERE item_id=?", id);
              addSafeDeleteCheck(
                `SELECT 1 FROM lesson_progress p JOIN course_catalog c ON c.id=p.lecture_id
                  WHERE c.parent_id=? OR (json_valid(c.metadata) AND COALESCE(
                    json_extract(c.metadata,'$.parentId'), json_extract(c.metadata,'$.parent_id'),
                    json_extract(c.metadata,'$.batchId'), json_extract(c.metadata,'$.seriesId')
                  )=?)`,
                id,
                id
              );
              addSafeDeleteCheck("SELECT 1 FROM course_subjects WHERE course_id=?", id);
              addSafeDeleteCheck("SELECT 1 FROM student_library WHERE item_id=?", id);
              addSafeDeleteCheck("SELECT 1 FROM drive_files WHERE course_id=? AND status!='deleted'", id);
            } else {
              if (currentRow.kind === "lecture" || currentRow.kind === "resource") {
                addSafeDeleteCheck("SELECT 1 FROM lesson_progress WHERE lecture_id=?", id);
              }
              if (currentRow.kind === "test") {
                addSafeDeleteCheck("SELECT 1 FROM exam_attempts WHERE test_id=?", id);
              }
              addSafeDeleteCheck("SELECT 1 FROM student_library WHERE item_id=?", id);
              const metadata = readJson(currentRow.metadata, {});
              addSafeDeleteCheck(
                "SELECT 1 FROM drive_files WHERE status!='deleted' AND (course_id=? OR id=?)",
                id,
                String(metadata.notesFileId || "__no_file__")
              );
            }
            await run(
              db,
              `DELETE FROM course_catalog WHERE id=? AND ${safeDeleteChecks.join(" AND ")}`,
              id,
              ...safeDeleteValues
            );
            if (await courseRow(db, id)) {
              return json({
                error: "CONTENT_HAS_DEPENDENCIES",
                detail: "Dependencies changed while deleting this item. Reload the content and review its relationships before retrying.",
              }, 409);
            }
            await activity(db, user, "content.delete", currentRow.kind, id, currentRow.title, { permanent: true });
            return json({ deleted: true, id, kind: currentRow.kind, title: currentRow.title });
          }
          await run(db, "UPDATE course_catalog SET active=0,updated_at=? WHERE id=?", now(), id);
          await activity(db, user, "content.disable", currentRow.kind, id, currentRow.title);
          return json({
            item: { id, kind: currentRow.kind, title: currentRow.title, active: false },
            disabled: true,
          });
        }
        const body = await readBody(request);
        const old = mapCourse(currentRow, true);
        const merged = {
          ...old,
          ...body,
          kind: body.kind ?? old.kind,
          classes: body.classes ?? old.classes,
          metadata: body.metadata ?? old.metadata,
          active: body.active === undefined ? old.active : body.active === true,
          accessCode: body.accessCode === undefined ? old.access_code ?? null : body.accessCode,
          parentId: body.parentId === undefined ? old.parentId : body.parentId,
          subjectId: body.subjectId === undefined ? old.subjectId : body.subjectId,
          sortOrder: body.sortOrder === undefined ? old.sortOrder : body.sortOrder,
        };
        const payload = coursePayload(merged);
        const relations = await validateCourseRelations(
          db,
          payload.kind,
          payload.parentId,
          payload.subjectId,
          old
        );
        const metadata = withRelationMetadata(payload, relations);
        await run(
          db,
          `UPDATE course_catalog
              SET kind=?,title=?,description=?,exam=?,classes=?,active=?,access_code=?,
                  metadata=?,parent_id=?,subject_id=?,sort_order=?,updated_at=?
            WHERE id=?`,
          payload.kind,
          payload.title,
          payload.description,
          payload.exam,
          JSON.stringify(payload.classes),
          payload.active ? 1 : 0,
          payload.accessCode,
          JSON.stringify(metadata),
          relations.parentId,
          relations.subjectId,
          payload.sortOrder,
          now(),
          id
        );
        await activity(db, user, "content.update", payload.kind, id, payload.title);
        return json({ item: mapCourse(await courseRow(db, id), true) });
      }

      // Announcements ------------------------------------------------------
      if (path === "/admin/announcements" && method === "GET") {
        const rows = await all(db, "SELECT * FROM announcements ORDER BY created_at DESC LIMIT 200");
        return json({ items: rows.map(mapAnnouncement) });
      }
      if (path === "/admin/announcements" && method === "POST") {
        const body = await readBody(request);
        const title = asText(body.title, 180);
        const announcementBody = String(body.body || "").trim().slice(0, 12000);
        if (!title || !announcementBody) return fail("Title and message are required.");
        const id = uuid();
        await run(
          db,
          "INSERT INTO announcements (id,title,body,audience,active,scheduled_at,created_at) VALUES (?,?,?,?,?,?,?)",
          id,
          title,
          announcementBody,
          asText(body.audience, 40) || "All",
          body.active ? 1 : 0,
          body.scheduledAt || null,
          now()
        );
        await activity(db, user, "announcement.create", "announcement", id, title);
        return json({ item: mapAnnouncement(await first(db, "SELECT * FROM announcements WHERE id=?", id)) }, 201);
      }
      if (segments[1] === "announcements" && segments.length === 3 && method === "PATCH") {
        const id = segments[2];
        const current = await first(db, "SELECT * FROM announcements WHERE id=?", id);
        if (!current) return fail("Announcement not found.", 404);
        const body = await readBody(request);
        await run(
          db,
          "UPDATE announcements SET title=?,body=?,audience=?,active=?,scheduled_at=? WHERE id=?",
          String(body.title ?? current.title).slice(0, 180),
          String(body.body ?? current.body).slice(0, 12000),
          String(body.audience ?? current.audience),
          body.active === undefined ? current.active : body.active ? 1 : 0,
          body.scheduledAt === undefined ? current.scheduled_at : body.scheduledAt,
          id
        );
        return json({ item: mapAnnouncement(await first(db, "SELECT * FROM announcements WHERE id=?", id)) });
      }

      // Site settings ------------------------------------------------------
      if (path === "/admin/site-settings" && method === "GET") {
        const rows = await all(db, "SELECT * FROM site_settings ORDER BY key");
        return json({
          items: rows.map((row) => ({
            ...row,
            draft: readJson(row.draft, {}),
            published: readJson(row.published, {}),
          })),
        });
      }
      if (segments[1] === "site-settings" && segments.length === 3 && method === "PATCH") {
        const key = segments[2];
        if (!SITE_SETTING_KEYS.has(key)) return fail("Unknown site setting key.", 400);
        const body = await readBody(request);
        if (!body.draft || typeof body.draft !== "object" || Array.isArray(body.draft)) {
          return fail("Draft must be a JSON object.");
        }
        const draft = JSON.stringify(body.draft);
        if (draft.length > MAX_BODY_BYTES) return fail("Setting is too large.", 413);
        const current = await first(db, "SELECT * FROM site_settings WHERE key=?", key);
        await run(
          db,
          `INSERT INTO site_settings (key,draft,published,published_at,updated_at,updated_by)
           VALUES (?,?,?,?,?,?)
           ON CONFLICT(key) DO UPDATE SET
             draft=excluded.draft,updated_at=excluded.updated_at,updated_by=excluded.updated_by`,
          key,
          draft,
          current?.published || "{}",
          current?.published_at || null,
          now(),
          user.email
        );
        await activity(db, user, "site_setting.draft", "site_setting", key, "Saved draft");
        const row = await first(db, "SELECT * FROM site_settings WHERE key=?", key);
        return json({
          item: { ...row, draft: readJson(row.draft, {}), published: readJson(row.published, {}) },
        });
      }
      if (segments[1] === "site-settings" && segments.length === 4 && segments[3] === "publish" && method === "POST") {
        const key = segments[2];
        if (!SITE_SETTING_KEYS.has(key)) return fail("Unknown site setting key.", 400);
        const current = await first(db, "SELECT * FROM site_settings WHERE key=?", key);
        if (!current) return fail("Setting draft not found.", 404);
        const timestamp = now();
        await run(
          db,
          "UPDATE site_settings SET published=draft,published_at=?,updated_at=?,updated_by=? WHERE key=?",
          timestamp,
          timestamp,
          user.email,
          key
        );
        await activity(db, user, "site_setting.publish", "site_setting", key, "Published setting");
        const row = await first(db, "SELECT * FROM site_settings WHERE key=?", key);
        return json({
          item: { ...row, draft: readJson(row.draft, {}), published: readJson(row.published, {}) },
        });
      }
      if (segments[1] === "site-settings" && segments.length === 3 && method === "DELETE") {
        const key = segments[2];
        if (!SITE_SETTING_KEYS.has(key)) return fail("Unknown site setting key.", 400);
        await run(db, "DELETE FROM site_settings WHERE key=?", key);
        await activity(db, user, "site_setting.reset", "site_setting", key, "Reset setting to code defaults");
        return json({ reset: true });
      }

      // Activity -----------------------------------------------------------
      if (path === "/admin/activity" && method === "GET") {
        const limit = Math.min(250, Math.max(1, Number(url.searchParams.get("limit") || 100)));
        return json({
          items: await all(db, "SELECT * FROM admin_activity ORDER BY created_at DESC LIMIT ?", limit),
        });
      }

      // Analytics ----------------------------------------------------------
      if (path === "/admin/analytics" && method === "GET") {
        const students = (await all(db, "SELECT * FROM student_profiles ORDER BY created_at DESC")).map(mapProfile);
        const contentRowsAll = await all(db, "SELECT * FROM course_catalog");
        const attempts = await all(
          db,
          `SELECT a.*, c.title AS test_title, c.metadata AS test_metadata
             FROM exam_attempts a LEFT JOIN course_catalog c ON c.id=a.test_id
            ORDER BY a.submitted_at DESC LIMIT 5000`
        );
        const enrollments = await all(
          db,
          `SELECT e.item_id, e.item_type, c.title, c.kind, COUNT(*) AS n
             FROM enrollments e LEFT JOIN course_catalog c ON c.id=e.item_id
            WHERE e.active=1
            GROUP BY e.item_id, e.item_type, c.title, c.kind
            ORDER BY n DESC`
        );

        const byExam = {};
        const byClass = {};
        for (const student of students) {
          if (student.exam) byExam[student.exam] = (byExam[student.exam] || 0) + 1;
          if (student.class_level) {
            byClass[student.class_level] = (byClass[student.class_level] || 0) + 1;
          }
        }

        const contentByKind = {};
        for (const row of contentRowsAll) {
          const bucket = contentByKind[row.kind] || { total: 0, active: 0 };
          bucket.total += 1;
          if (asBool(row.active)) bucket.active += 1;
          contentByKind[row.kind] = bucket;
        }

        const dayMap = new Map();
        for (let offset = 13; offset >= 0; offset -= 1) {
          const date = new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
          dayMap.set(date, 0);
        }
        for (const attempt of attempts) {
          const day = String(attempt.submitted_at || "").slice(0, 10);
          if (dayMap.has(day)) dayMap.set(day, dayMap.get(day) + 1);
        }

        const attemptTotals = attempts.reduce(
          (accumulator, attempt) => {
            const max = Number(attempt.max_score) || 0;
            const score = Number(attempt.score) || 0;
            accumulator.score += Math.max(0, score);
            accumulator.max += max;
            return accumulator;
          },
          { score: 0, max: 0 }
        );

        const perStudent = new Map();
        for (const attempt of attempts) {
          const key = attempt.firebase_uid;
          const bucket = perStudent.get(key) || { attempts: 0, score: 0, max: 0 };
          bucket.attempts += 1;
          bucket.score += Math.max(0, Number(attempt.score) || 0);
          bucket.max += Number(attempt.max_score) || 0;
          perStudent.set(key, bucket);
        }
        const profileByUid = new Map(students.map((student) => [student.firebase_uid, student]));
        const topStudents = [...perStudent.entries()]
          .map(([uid, bucket]) => {
            const profile = profileByUid.get(uid);
            return {
              firebaseUid: uid,
              name: profile ? profile.display_name : "Student",
              avatarUrl: profile ? profile.avatar_url : null,
              attempts: bucket.attempts,
              averagePercentage: bucket.max > 0 ? (bucket.score / bucket.max) * 100 : 0,
            };
          })
          .sort((a, b) => b.averagePercentage - a.averagePercentage)
          .slice(0, 10);

        const subjectMap = new Map();
        for (const attempt of attempts) {
          const metadata = readJson(attempt.test_metadata, {});
          const subject = asText(metadata.subject, 80) || "General";
          const bucket = subjectMap.get(subject) || {
            subject,
            attempts: 0,
            score: 0,
            max: 0,
            correct: 0,
            incorrect: 0,
            unanswered: 0,
          };
          bucket.attempts += 1;
          bucket.score += Math.max(0, Number(attempt.score) || 0);
          bucket.max += Number(attempt.max_score) || 0;
          bucket.correct += Number(attempt.correct_count) || 0;
          bucket.incorrect += Number(attempt.incorrect_count) || 0;
          bucket.unanswered += Number(attempt.unanswered_count) || 0;
          subjectMap.set(subject, bucket);
        }
        const subjectPerformance = [...subjectMap.values()]
          .map((bucket) => ({
            subject: bucket.subject,
            attempts: bucket.attempts,
            averagePercentage: bucket.max > 0 ? (bucket.score / bucket.max) * 100 : 0,
            correct: bucket.correct,
            incorrect: bucket.incorrect,
            unanswered: bucket.unanswered,
          }))
          .sort((a, b) => b.attempts - a.attempts);

        const contentHealth = {
          missingThumbnails: 0,
          testsWithoutQuestions: 0,
          eventsMissingSchedule: 0,
          inactiveContent: 0,
        };
        for (const row of contentRowsAll) {
          const metadata = readJson(row.metadata, {});
          if (!metadata.thumbnailUrl && ["lecture", "event", "test"].includes(row.kind)) {
            contentHealth.missingThumbnails += 1;
          }
          if (row.kind === "test" && !(Array.isArray(metadata.questions) && metadata.questions.length)) {
            contentHealth.testsWithoutQuestions += 1;
          }
          if (row.kind === "event" && !metadata.startsAt) contentHealth.eventsMissingSchedule += 1;
          if (!asBool(row.active)) contentHealth.inactiveContent += 1;
        }

        return json({
          students: {
            total: students.length,
            byExam,
            byClass,
            recent: students.slice(0, 8).map((student) => ({
              firebase_uid: student.firebase_uid,
              display_name: student.display_name,
              email: student.email,
              exam: student.exam,
              class_level: student.class_level,
              created_at: student.created_at,
            })),
          },
          content: {
            total: contentRowsAll.length,
            active: contentRowsAll.filter((row) => asBool(row.active)).length,
            byKind: contentByKind,
          },
          attempts: {
            total: attempts.length,
            averagePercentage:
              attemptTotals.max > 0 ? (attemptTotals.score / attemptTotals.max) * 100 : 0,
            last14Days: [...dayMap.entries()].map(([date, count]) => ({ date, count })),
            topStudents,
          },
          subjectPerformance,
          enrollments: {
            total: enrollments.reduce((sum, row) => sum + Number(row.n || 0), 0),
            byItem: enrollments.map((row) => ({
              itemId: row.item_id,
              title: row.title || row.item_id,
              kind: row.kind || row.item_type,
              count: Number(row.n) || 0,
            })),
          },
          contentHealth,
        });
      }

      // Enrollments --------------------------------------------------------
      if (path === "/admin/enrollments" && method === "GET") {
        const status = url.searchParams.get("status") || "active";
        const q = (url.searchParams.get("query") || "").toLowerCase();
        const itemId = url.searchParams.get("itemId") || "";
        const itemType = url.searchParams.get("itemType") || "";
        const page = Math.max(1, Number(url.searchParams.get("page") || 1));
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 25)));
        let items = await all(
          db,
          `SELECT e.*, p.display_name, p.email, c.title AS item_title
             FROM enrollments e
             LEFT JOIN student_profiles p ON p.firebase_uid=e.firebase_uid
             LEFT JOIN course_catalog c ON c.id=e.item_id
            ORDER BY e.updated_at DESC`
        );
        items = items
          .map((row) => ({
            ...row,
            active: asBool(row.active),
            status: row.status || (asBool(row.active) ? "active" : "revoked"),
            student_name: row.display_name,
            student_email: row.email,
          }))
          .filter(
            (row) =>
              (status === "all" || row.status === status) &&
              (!itemId || row.item_id === itemId) &&
              (!itemType || row.item_type === itemType) &&
              (!q ||
                String(row.student_name || "").toLowerCase().includes(q) ||
                String(row.student_email || "").toLowerCase().includes(q) ||
                String(row.item_title || "").toLowerCase().includes(q) ||
                row.firebase_uid.toLowerCase().includes(q))
          );
        const countRows = await all(
          db,
          "SELECT COALESCE(status, CASE WHEN active=1 THEN 'active' ELSE 'revoked' END) AS status, COUNT(*) AS n FROM enrollments GROUP BY status"
        );
        const counts = { active: 0, revoked: 0, total: 0 };
        for (const row of countRows) {
          counts[row.status || "active"] = Number(row.n) || 0;
          counts.total += Number(row.n) || 0;
        }
        return json({
          items: items.slice((page - 1) * pageSize, page * pageSize),
          total: items.length,
          page,
          pageSize,
          counts,
        });
      }
      if (path === "/admin/enrollments" && method === "POST") {
        const body = await readBody(request);
        const item = await courseRow(db, asText(body.itemId, 120));
        if (!item || !["batch", "series"].includes(item.kind)) return fail("Batch or series not found.", 404);
        const profile = await getProfile(db, asText(body.studentUid, 200));
        if (!profile) return fail("Student profile not found.", 404);
        const timestamp = now();
        const id = uuid();
        await run(
          db,
          `INSERT INTO enrollments
             (id,firebase_uid,item_type,item_id,active,status,source,granted_by,expires_at,created_at,updated_at,metadata)
           VALUES (?,?,?,?,1,'active','manual',?,?,?,?,'{}')
           ON CONFLICT(firebase_uid,item_type,item_id) DO UPDATE SET
             active=1,status='active',source='manual',granted_by=excluded.granted_by,
             expires_at=excluded.expires_at,revoked_at=NULL,updated_at=excluded.updated_at`,
          id,
          profile.firebase_uid,
          item.kind,
          item.id,
          user.uid,
          body.expiresAt || null,
          timestamp,
          timestamp
        );
        const row = await first(
          db,
          "SELECT * FROM enrollments WHERE firebase_uid=? AND item_type=? AND item_id=?",
          profile.firebase_uid,
          item.kind,
          item.id
        );
        await run(
          db,
          "INSERT INTO enrollment_events (id,enrollment_id,firebase_uid,item_type,item_id,action,source,actor_uid,actor_email,detail,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          uuid(),
          row.id,
          profile.firebase_uid,
          item.kind,
          item.id,
          "granted",
          "manual",
          user.uid,
          user.email,
          "{}",
          timestamp
        );
        await activity(db, user, "enrollment.grant", "enrollment", row.id, "Granted course access", {
          studentUid: profile.firebase_uid,
          itemId: item.id,
        });
        return json({ item: { ...row, active: true, status: "active", student_name: profile.display_name } }, 201);
      }
      if (path === "/admin/enrollments/bulk" && method === "POST") {
        const body = await readBody(request);
        const item = await courseRow(db, asText(body.itemId, 120));
        if (!item || !["batch", "series"].includes(item.kind)) return fail("Batch or series not found.", 404);
        let students = await all(db, "SELECT * FROM student_profiles");
        if (body.mode === "selected") {
          const chosen = new Set((Array.isArray(body.studentUids) ? body.studentUids : []).slice(0, 500));
          students = students.filter((student) => chosen.has(student.firebase_uid));
        } else if (body.mode === "filter" || body.exam || body.classLevel) {
          students = students.filter(
            (student) =>
              (!body.exam || student.exam === body.exam) &&
              (!body.classLevel || student.class_level === body.classLevel)
          );
        }
        if (students.length > 500 && !body.dryRun) {
          return fail("Audience is too large; narrow the filter or process in smaller batches.", 409);
        }
        if ((body.mode === "all" || body.mode === "filter") && !body.confirmAll && !body.dryRun) {
          return json(
            {
              error: "CONFIRMATION_REQUIRED",
              message: "Confirm the resolved audience before granting access.",
              total: students.length,
            },
            409
          );
        }
        if (body.dryRun) {
          return json({
            dryRun: true,
            total: students.length,
            eligible: students.length,
            created: 0,
            skipped: 0,
            failed: 0,
          });
        }
        const timestamp = now();
        const statements = students.map((student) =>
          db
            .prepare(
              `INSERT INTO enrollments
                 (id,firebase_uid,item_type,item_id,active,status,source,granted_by,expires_at,created_at,updated_at,metadata)
               VALUES (?,?,?, ?,1,'active','admin_bulk',?,?,?,?,'{}')
               ON CONFLICT(firebase_uid,item_type,item_id) DO UPDATE SET
                 active=1,status='active',source='admin_bulk',granted_by=excluded.granted_by,
                 expires_at=excluded.expires_at,revoked_at=NULL,updated_at=excluded.updated_at`
            )
            .bind(
              uuid(),
              student.firebase_uid,
              item.kind,
              item.id,
              user.uid,
              body.expiresAt || null,
              timestamp,
              timestamp
            )
        );
        for (let index = 0; index < statements.length; index += 100) {
          await batch(db, statements.slice(index, index + 100));
        }
        await activity(db, user, "enrollment.bulk", "enrollment", item.id, "Bulk enrollment", {
          students: students.length,
          itemType: item.kind,
        });
        return json({
          created: students.length,
          reactivated: 0,
          skipped: 0,
          failed: 0,
          total: students.length,
        });
      }
      if (path === "/admin/enrollments/bulk-revoke" && method === "POST") {
        const body = await readBody(request);
        if (body.confirm !== "REVOKE") return fail("Explicit revoke confirmation required.");
        const uids = Array.isArray(body.studentUids) ? body.studentUids.slice(0, 500) : [];
        let revoked = 0;
        for (let index = 0; index < uids.length; index += 100) {
          const statements = uids.slice(index, index + 100).map((uid) =>
            db
              .prepare(
                "UPDATE enrollments SET active=0,status='revoked',revoked_at=?,updated_at=? WHERE firebase_uid=? AND item_type=? AND item_id=? AND active=1"
              )
              .bind(now(), now(), uid, body.itemType, body.itemId)
          );
          const result = await batch(db, statements);
          revoked += result.reduce((sum, entry) => sum + Number(entry?.meta?.changes || 0), 0);
        }
        return json({ revoked, failed: Math.max(0, uids.length - revoked) });
      }
      if (segments[1] === "enrollments" && segments.length === 3 && method === "DELETE") {
        const id = segments[2];
        const current = await first(db, "SELECT * FROM enrollments WHERE id=?", id);
        if (!current) return fail("Enrollment not found.", 404);
        await run(
          db,
          "UPDATE enrollments SET active=0,status='revoked',revoked_at=?,updated_at=? WHERE id=?",
          now(),
          now(),
          id
        );
        await run(
          db,
          "INSERT INTO enrollment_events (id,enrollment_id,firebase_uid,item_type,item_id,action,source,actor_uid,actor_email,detail,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          uuid(),
          id,
          current.firebase_uid,
          current.item_type,
          current.item_id,
          "revoked",
          "manual",
          user.uid,
          user.email,
          "{}",
          now()
        );
        await activity(db, user, "enrollment.revoke", "enrollment", id, "Revoked course access");
        return json({ removed: true });
      }
      if (segments[1] === "enrollments" && segments.length === 4 && segments[3] === "restore" && method === "POST") {
        const id = segments[2];
        await run(
          db,
          "UPDATE enrollments SET active=1,status='active',revoked_at=NULL,updated_at=? WHERE id=?",
          now(),
          id
        );
        const row = await first(db, "SELECT * FROM enrollments WHERE id=?", id);
        if (!row) return fail("Enrollment not found.", 404);
        await run(
          db,
          "INSERT INTO enrollment_events (id,enrollment_id,firebase_uid,item_type,item_id,action,source,actor_uid,actor_email,detail,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          uuid(),
          id,
          row.firebase_uid,
          row.item_type,
          row.item_id,
          "reactivated",
          "manual",
          user.uid,
          user.email,
          "{}",
          now()
        );
        return json({ item: { ...row, active: true, status: "active" } });
      }
      if ((path === "/admin/enrollment-history" || path === "/admin/enrollments/history") && method === "GET") {
        const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 120)));
        return json({
          items: await all(db, "SELECT * FROM enrollment_events ORDER BY created_at DESC LIMIT ?", limit),
        });
      }
      if (path === "/admin/enrollment-rules" && method === "GET") {
        return json({ items: await all(db, "SELECT * FROM enrollment_rules ORDER BY created_at DESC") });
      }
      if (segments[1] === "enrollment-rules" && segments.length === 3 && method === "PATCH") {
        const body = await readBody(request);
        await run(db, "UPDATE enrollment_rules SET active=?,updated_at=? WHERE id=?", body.active ? 1 : 0, now(), segments[2]);
        return json({ item: await first(db, "SELECT * FROM enrollment_rules WHERE id=?", segments[2]) });
      }
      if (segments[1] === "enrollment-rules" && segments.length === 3 && method === "DELETE") {
        await run(db, "DELETE FROM enrollment_rules WHERE id=?", segments[2]);
        return json({ removed: true });
      }

      // Feedback inbox -----------------------------------------------------
      if (path === "/admin/feedback" && method === "GET") {
        const status = url.searchParams.get("status") || "";
        const q = (url.searchParams.get("query") || "").toLowerCase();
        const category = url.searchParams.get("category") || "";
        let rows = await all(
          db,
          `SELECT f.*, p.display_name, p.email, p.exam, p.class_level
             FROM feedback_threads f
             LEFT JOIN student_profiles p ON p.firebase_uid=f.firebase_uid
            ORDER BY f.updated_at DESC LIMIT 300`
        );
        rows = rows
          .map(mapFeedbackThread)
          .filter(
            (row) =>
              (!status || row.status === status) &&
              (!category || row.category === category) &&
              (!q ||
                String(row.subject || "").toLowerCase().includes(q) ||
                String(row.last_message_text || "").toLowerCase().includes(q) ||
                String(row.display_name || "").toLowerCase().includes(q) ||
                String(row.email || "").toLowerCase().includes(q))
          );
        return json({ items: rows });
      }
      if (segments[1] === "feedback" && segments.length === 3 && method === "GET") {
        const item = await first(
          db,
          `SELECT f.*, p.display_name, p.email, p.exam, p.class_level
             FROM feedback_threads f
             LEFT JOIN student_profiles p ON p.firebase_uid=f.firebase_uid
            WHERE f.id=?`,
          segments[2]
        );
        if (!item) return fail("Feedback not found.", 404);
        await run(
          db,
          "UPDATE feedback_messages SET is_read=1,read_at=? WHERE thread_id=? AND sender_role='student' AND is_read=0",
          now(),
          segments[2]
        );
        await run(db, "UPDATE feedback_threads SET unread_by_admin=0 WHERE id=?", segments[2]);
        return json({ item: mapFeedbackThread(item), messages: await listFeedbackMessages(db, segments[2]) });
      }
      if (segments[1] === "feedback" && segments.length === 4 && segments[3] === "reply" && method === "POST") {
        const id = segments[2];
        const body = await readBody(request);
        const text = asText(body.message || body.text, 5000);
        const item = await first(db, "SELECT * FROM feedback_threads WHERE id=?", id);
        if (!item) return fail("Feedback not found.", 404);
        if (!text) return fail("Reply cannot be empty.");
        const timestamp = now();
        await run(
          db,
          "INSERT INTO feedback_messages (id,thread_id,sender_uid,sender_role,text,created_at,is_read,read_at,payload) VALUES (?,?,?,?,?,?,0,NULL,'{}')",
          uuid(),
          id,
          user.uid,
          "admin",
          text,
          timestamp
        );
        await run(
          db,
          "UPDATE feedback_threads SET status='in_progress',resolved_at=NULL,last_message_text=?,last_message_at=?,unread_by_student=1,updated_at=? WHERE id=?",
          text.slice(0, 200),
          timestamp,
          timestamp,
          id
        );
        await activity(db, user, "feedback.reply", "feedback", id, "Replied to student feedback");
        await logNotification(db, item.firebase_uid, {
          title: "Feedback response",
          body: text.slice(0, 500),
          deepLink: "/feedback",
          type: "feedback",
        });
        return json({
          item: mapFeedbackThread(await first(db, "SELECT * FROM feedback_threads WHERE id=?", id)),
          messages: await listFeedbackMessages(db, id),
        });
      }
      if (segments[1] === "feedback" && segments.length === 3 && method === "PATCH") {
        const body = await readBody(request);
        const id = segments[2];
        if (body.markRead === true) {
          await run(
            db,
            "UPDATE feedback_messages SET is_read=1,read_at=? WHERE thread_id=? AND sender_role='student' AND is_read=0",
            now(),
            id
          );
          await run(db, "UPDATE feedback_threads SET unread_by_admin=0 WHERE id=?", id);
          return json({ item: mapFeedbackThread(await first(db, "SELECT * FROM feedback_threads WHERE id=?", id)) });
        }
        const status = String(body.status || "");
        if (!FEEDBACK_STATUSES.has(status)) return fail("Invalid feedback status.");
        await run(
          db,
          "UPDATE feedback_threads SET status=?,resolved_at=?,updated_at=? WHERE id=?",
          status,
          status === "resolved" ? now() : null,
          now(),
          id
        );
        await activity(db, user, "feedback.status", "feedback", id, "Changed feedback status", { status });
        return json({ item: mapFeedbackThread(await first(db, "SELECT * FROM feedback_threads WHERE id=?", id)) });
      }

      // Notifications ------------------------------------------------------
      if (path === "/admin/notifications" && method === "POST") {
        const body = await readBody(request);
        const uids = Array.isArray(body.studentUids) ? Array.from(new Set(body.studentUids.map(String))).slice(0, 500) : [];
        const input = body.input && typeof body.input === "object" ? body.input : body;
        const title = asText(input.title, 160);
        const notificationBody = asText(input.body, 2000);
        if (!title || !notificationBody) return fail("Notification title and body are required.");
        const placeholders = uids.map(() => "?").join(",");
        const existing = uids.length
          ? await all(db, `SELECT firebase_uid FROM student_profiles WHERE firebase_uid IN (${placeholders})`, ...uids)
          : [];
        const existingSet = new Set(existing.map((row) => row.firebase_uid));
        let sent = 0;
        for (let index = 0; index < uids.length; index += 100) {
          const chunk = uids.slice(index, index + 100).filter((uid) => existingSet.has(uid));
          if (!chunk.length) continue;
          const timestamp = now();
          const statements = chunk.map((uid) =>
            db
              .prepare("INSERT INTO notifications (id,firebase_uid,is_read,created_at,payload) VALUES (?,?,?,?,?)")
              .bind(
                uuid(),
                uid,
                0,
                timestamp,
                JSON.stringify({
                  title,
                  body: notificationBody,
                  deepLink: input.deepLink || null,
                  type: input.type || "info",
                })
              )
          );
          await batch(db, statements);
          sent += chunk.length;
        }
        return json({ sent, failed: uids.filter((uid) => !existingSet.has(uid)) });
      }

      // Google Drive administration ----------------------------------------
      if (path === "/admin/drive/files" && method === "GET") {
        const courseId = url.searchParams.get("courseId") || "";
        const purpose = url.searchParams.get("purpose") || "";
        const status = url.searchParams.get("status") || "active";
        const clauses = [];
        const values = [];
        if (courseId) {
          clauses.push("d.course_id = ?");
          values.push(courseId);
        }
        if (purpose) {
          clauses.push("d.purpose = ?");
          values.push(purpose);
        }
        if (status && status !== "all") {
          clauses.push("d.status = ?");
          values.push(status);
        }
        const rows = await all(
          db,
          `SELECT d.*, c.title AS course_title
             FROM drive_files d LEFT JOIN course_catalog c ON c.id=d.course_id
            ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
            ORDER BY d.created_at DESC LIMIT 500`,
          ...values
        );
        return json({ items: rows.map(mapDriveFile) });
      }
      if (path === "/admin/drive/upload" && method === "POST") {
        const limit = maxUploadBytes(env, "GOOGLE_DRIVE_MAX_PDF_MB", 20);
        const { form, value, bytes } = await readMultipartFile(request, limit);
        if (!detectPdf(bytes)) {
          return fail("Course attachments must be valid PDF files. The file contents did not match a PDF signature.", 415);
        }
        const courseId = asText(form.get("courseId"), 120);
        const course = courseId ? await courseRow(db, courseId) : null;
        if (!course) return fail("Choose the lecture, resource or course for this PDF.", 400);
        const displayName = safeDisplayName(form.get("displayName") || value.name, "Course notes.pdf");
        let uploaded;
        try {
          uploaded = await uploadDriveFile(env, {
            bytes,
            mimeType: "application/pdf",
            name: `ec-pdf-${uuid()}.pdf`,
            purpose: "pdf",
          });
        } catch (error) {
          const status = Number(error && error.status) || 502;
          return fail(error instanceof Error ? error.message : "Google Drive upload failed.", status);
        }
        const recordId = uuid();
        try {
          await run(
            db,
            `INSERT INTO drive_files
               (id,drive_file_id,owner_uid,uploader_uid,purpose,course_id,subject_id,
                mime_type,display_name,size_bytes,status,visibility,created_at,updated_at)
             VALUES (?,?,NULL,?,?,?,?,?,?,?,?,?,?,?)`,
            recordId,
            uploaded.id,
            user.uid,
            "pdf",
            course.id,
            course.subject_id || null,
            "application/pdf",
            displayName,
            bytes.length,
            "active",
            "course",
            now(),
            now()
          );
        } catch {
          try {
            await deleteDriveFile(env, uploaded.id);
          } catch {
            // No D1 row was created; report failure rather than a false success.
          }
          return fail("The PDF was uploaded to Drive but its D1 metadata could not be saved. The upload was rolled back where possible.", 500);
        }
        await activity(db, user, "drive.pdf.upload", "content", course.id, displayName);
        const row = await first(
          db,
          `SELECT d.*, c.title AS course_title FROM drive_files d
             LEFT JOIN course_catalog c ON c.id=d.course_id WHERE d.id=?`,
          recordId
        );
        return json({ file: mapDriveFile(row) }, 201);
      }
      if (segments[1] === "drive" && segments[2] === "files" && segments.length === 4 && method === "DELETE") {
        const row = await first(db, "SELECT * FROM drive_files WHERE id=?", segments[3]);
        if (!row) return fail("File not found.", 404);
        if (row.purpose !== "pdf") {
          return fail("Profile photos can only be replaced by their owner.", 403);
        }
        await run(db, "UPDATE drive_files SET status='deleted',deleted_at=?,updated_at=? WHERE id=?", now(), now(), row.id);
        let driveDeleted = false;
        try {
          driveDeleted = await deleteDriveFile(env, row.drive_file_id);
        } catch {
          driveDeleted = false;
        }
        await activity(db, user, "drive.pdf.delete", "content", row.course_id || row.id, row.display_name, {
          driveDeleted,
        });
        return json({ removed: true, driveDeleted });
      }
      if (path === "/admin/drive/cleanup" && method === "POST") {
        const rows = await all(
          db,
          "SELECT * FROM drive_files WHERE status IN ('orphan','deleted','superseded') ORDER BY updated_at LIMIT 25"
        );
        let deleted = 0;
        let failed = 0;
        for (const row of rows) {
          let success = false;
          try {
            success = await deleteDriveFile(env, row.drive_file_id);
          } catch {
            success = false;
          }
          if (success) {
            deleted += 1;
            await run(
              db,
              "UPDATE drive_files SET status='deleted',deleted_at=?,updated_at=? WHERE id=?",
              now(),
              now(),
              row.id
            );
          } else {
            failed += 1;
          }
        }
        return json({ checked: rows.length, deleted, failed });
      }
    }

    return fail("Endpoint not found.", 404);
  } catch (error) {
    const status = Number(error && error.status) || 500;
    const message =
      status >= 500
        ? status === 502 || status === 503
          ? String(error && error.message) || "The requested service is unavailable."
          : "Exam Cracker server error. Please retry."
        : String((error && error.message) || "Request failed.");
    return fail(message, status, status >= 500 || status === 400 ? undefined : String(error && error.message || ""));
  }
}

export default {
  async fetch(request, env) {
    return handleApiRequest(request, env);
  },
};
