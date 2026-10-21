const FIREBASE_PROJECT_ID = "darvo1";
const ADMIN_EMAIL = "arvinddarabishnoi@gmail.com";
const ALLOWED_ORIGINS = new Set([
  "https://examcrack.pages.dev",
  "https://exam-cracker-web.arvinddara0290.workers.dev",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const MAX_BODY_BYTES = 512 * 1024;
let jwksCache = { keys: [], expiresAt: 0 };

const json = (data, status = 200, extraHeaders = {}) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extraHeaders },
});
const fail = (error, status = 400, detail) => json({ error, ...(detail ? { detail } : {}) }, status);
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const asBool = (v) => v === true || v === 1 || v === "1";
const readJson = (v, fallback = {}) => {
  if (v === null || v === undefined || v === "") return fallback;
  try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return fallback; }
};
const b64url = (value) => value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
const decodeB64urlJson = (value) => JSON.parse(atob(b64url(value)));

async function readBody(request) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY_BYTES) throw Object.assign(new Error("Request body is too large."), { status: 413 });
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw Object.assign(new Error("Request body is too large."), { status: 413 });
  if (!text.trim()) return {};
  try { return JSON.parse(text); } catch { throw Object.assign(new Error("Invalid JSON body."), { status: 400 }); }
}

async function loadJwks(force = false) {
  if (!force && jwksCache.expiresAt > Date.now() && jwksCache.keys.length) return jwksCache.keys;
  const response = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com", {
    headers: { "Accept": "application/json" },
  });
  if (!response.ok) throw new Error("Unable to verify the Firebase session right now.");
  const payload = await response.json();
  jwksCache = { keys: Array.isArray(payload.keys) ? payload.keys : [], expiresAt: Date.now() + 45 * 60 * 1000 };
  return jwksCache.keys;
}
async function verifyFirebaseToken(request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error("Sign-in required."), { status: 401 });
  const token = match[1];
  const parts = token.split(".");
  if (parts.length !== 3) throw Object.assign(new Error("Invalid Firebase session."), { status: 401 });
  let header, claims;
  try { header = decodeB64urlJson(parts[0]); claims = decodeB64urlJson(parts[1]); }
  catch { throw Object.assign(new Error("Invalid Firebase session."), { status: 401 }); }
  if (header.alg !== "RS256" || !header.kid) throw Object.assign(new Error("Unsupported Firebase token."), { status: 401 });
  const issuer = "https://securetoken.google.com/" + FIREBASE_PROJECT_ID;
  const current = Math.floor(Date.now() / 1000);
  if (claims.aud !== FIREBASE_PROJECT_ID || claims.iss !== issuer ||
      typeof claims.sub !== "string" || !claims.sub ||
      !Number.isFinite(claims.exp) || claims.exp <= current ||
      !Number.isFinite(claims.iat) || claims.iat > current + 60) {
    throw Object.assign(new Error("Firebase session is invalid or expired."), { status: 401 });
  }
  let jwks = await loadJwks();
  let jwk = jwks.find((item) => item.kid === header.kid);
  if (!jwk) { jwks = await loadJwks(true); jwk = jwks.find((item) => item.kid === header.kid); }
  if (!jwk) throw Object.assign(new Error("Could not verify Firebase signing key."), { status: 401 });
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const signature = Uint8Array.from(atob(b64url(parts[2])), (ch) => ch.charCodeAt(0));
  const message = new TextEncoder().encode(parts[0] + "." + parts[1]);
  const valid = await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, signature, message);
  if (!valid) throw Object.assign(new Error("Firebase session signature is invalid."), { status: 401 });
  return { uid: claims.sub, email: typeof claims.email === "string" ? claims.email.toLowerCase() : "", name: claims.name || "", picture: claims.picture || null, claims };
}
const isAdmin = (user) => user.email === ADMIN_EMAIL;
function requireAdmin(user) {
  if (!isAdmin(user)) throw Object.assign(new Error("Admin access is restricted to the configured administrator email."), { status: 403 });
}
function assertDb(env) {
  if (!env || !env.DB || typeof env.DB.prepare !== "function") {
    throw Object.assign(new Error("Cloudflare D1 binding DB is unavailable. Check the exam-cracker-web Wrangler binding."), { status: 503 });
  }
  return env.DB;
}
async function all(db, sql, ...values) {
  const stmt = db.prepare(sql);
  const result = values.length ? await stmt.bind(...values).all() : await stmt.all();
  if (result.success === false) throw new Error("Database query failed.");
  return result.results || [];
}
async function first(db, sql, ...values) {
  const stmt = db.prepare(sql);
  return values.length ? stmt.bind(...values).first() : stmt.first();
}
async function run(db, sql, ...values) {
  const stmt = db.prepare(sql);
  const result = values.length ? await stmt.bind(...values).run() : await stmt.run();
  if (result.success === false) throw new Error("Database write failed.");
  return result;
}
async function batch(db, statements) {
  if (statements.length) await db.batch(statements);
}
async function activity(db, user, action, targetType = "", targetId = "", summary = "", metadata = {}) {
  await run(db, "INSERT INTO admin_activity (id,actor_uid,actor_email,action,target_type,target_id,summary,metadata,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    uuid(), user.uid, user.email, action, targetType, targetId, summary, JSON.stringify(metadata || {}), now());
}
function mapProfile(row) {
  if (!row) return null;
  return { ...row, exam: row.exam || null, class_level: row.class_level || null };
}
function mapCourse(row, admin = false) {
  if (!row) return null;
  const classes = readJson(row.classes, ["11", "12"]);
  const metadata = readJson(row.metadata, {});
  const out = {
    ...row,
    classes: Array.isArray(classes) ? classes : ["11", "12"],
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    active: asBool(row.active),
    hasAccessCode: Boolean(row.access_code || metadata.requiresAccessCode || metadata.hasAccessCode),
  };
  if (!admin) {
    delete out.access_code;
    if (out.kind === "test" && Array.isArray(out.metadata.questions)) {
      out.metadata = { ...out.metadata, questions: out.metadata.questions.map(redactQuestion) };
    }
  }
  return out;
}
function redactQuestion(q) {
  const copy = { ...q };
  for (const key of ["answer", "correctAnswer", "correct_answer", "answerKey", "explanation", "rationale"]) delete copy[key];
  return copy;
}
function coursePayload(body) {
  const kinds = new Set(["batch", "series", "lecture", "resource", "event", "goal", "test"]);
  const exam = String(body.exam || "Both");
  const kind = String(body.kind || "");
  const title = String(body.title || "").trim();
  const classes = Array.isArray(body.classes) ? body.classes.map(String) : ["11", "12"];
  if (!kinds.has(kind)) throw Object.assign(new Error("Invalid content type."), { status: 400 });
  if (!title || title.length > 180) throw Object.assign(new Error("Title is required and must be 180 characters or fewer."), { status: 400 });
  if (!["JEE", "NEET", "Both"].includes(exam)) throw Object.assign(new Error("Invalid exam track."), { status: 400 });
  if (!classes.length || classes.some((x) => !["11", "12"].includes(x))) throw Object.assign(new Error("Choose Class 11, Class 12, or both."), { status: 400 });
  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  return {
    kind, title, description: String(body.description || "").slice(0, 12000),
    exam, classes, active: body.active === true,
    accessCode: body.accessCode === undefined ? (body.access_code || null) : (body.accessCode || null),
    metadata,
  };
}
async function getProfile(db, uid) {
  return mapProfile(await first(db, "SELECT * FROM student_profiles WHERE firebase_uid = ?", uid));
}
async function contentRows(db, { activeOnly = false, kind = "", exam = "", classLevel = "", parentId = "" } = {}) {
  const rows = await all(db, "SELECT * FROM course_catalog ORDER BY created_at DESC");
  return rows.map((row) => mapCourse(row, true)).filter((row) => {
    if (activeOnly && !row.active) return false;
    if (kind && row.kind !== kind) return false;
    if (exam && row.exam !== exam && row.exam !== "Both") return false;
    if (classLevel && !row.classes.includes(classLevel)) return false;
    if (parentId && String(row.metadata.parentId || row.metadata.batchId || row.metadata.seriesId || "") !== parentId) return false;
    return true;
  });
}
async function hasEnrollment(db, uid, itemId) {
  const row = await first(db, "SELECT id FROM enrollments WHERE firebase_uid=? AND item_id=? AND active=1 AND status='active' AND (expires_at IS NULL OR expires_at > ?)", uid, itemId, now());
  return Boolean(row);
}
function visibleBySchedule(row) {
  const starts = row.metadata && row.metadata.startsAt ? Date.parse(row.metadata.startsAt) : NaN;
  const ends = row.metadata && row.metadata.endsAt ? Date.parse(row.metadata.endsAt) : NaN;
  const n = Date.now();
  return (!Number.isFinite(starts) || starts <= n) && (!Number.isFinite(ends) || ends >= n);
}
function requireProfile(profile) {
  if (!profile) throw Object.assign(new Error("Finish onboarding first."), { status: 409 });
}
function parseAttempt(row) {
  if (!row) return null;
  return { ...row, answers: readJson(row.answers, []) };
}
function scoreTest(test, submittedAnswers) {
  const metadata = test.metadata || {};
  const questions = Array.isArray(metadata.questions) ? metadata.questions : [];
  const defaultMarks = Number(metadata.marksPerQuestion ?? metadata.marks_per_question ?? 4);
  const negativeMarks = Math.max(0, Number(metadata.negativeMarks ?? metadata.negativeMarking ?? metadata.negative_marks ?? 1));
  let correct = 0, incorrect = 0, unanswered = 0, score = 0, maxScore = 0;
  const review = questions.map((question, index) => {
    const qid = String(question.id ?? question.questionId ?? index);
    const given = submittedAnswers[qid] ?? submittedAnswers[String(index)] ?? "";
    const expected = question.correctAnswer ?? question.correct_answer ?? question.answer ?? question.answerKey ?? null;
    const marks = Number(question.marks ?? defaultMarks);
    maxScore += Number.isFinite(marks) ? marks : 0;
    const normal = (v) => Array.isArray(v) ? v.map(String).sort().join("|") : String(v ?? "").trim().toLowerCase();
    const isAnswered = given !== "" && given !== null && given !== undefined;
    const isCorrect = isAnswered && expected !== null && normal(given) === normal(expected);
    if (!isAnswered) unanswered++;
    else if (isCorrect) { correct++; score += marks; }
    else { incorrect++; score -= negativeMarks; }
    return {
      questionId: qid,
      prompt: String(question.question || question.prompt || question.text || ""),
      options: question.options || [],
      selectedAnswer: given,
      correctAnswer: expected,
      isCorrect: Boolean(isCorrect),
      explanation: question.explanation || question.rationale || "",
      marks: isCorrect ? marks : (isAnswered ? -negativeMarks : 0),
    };
  });
  return { score: Math.max(-maxScore, score), maxScore, correct, incorrect, unanswered, review, questionsCount: questions.length };
}
async function logNotification(db, uid, input) {
  await run(db, "INSERT INTO notifications (id,firebase_uid,is_read,created_at,payload) VALUES (?,?,?,?,?)",
    uuid(), uid, 0, now(), JSON.stringify({
      title: String(input.title || "").trim().slice(0, 160),
      body: String(input.body || "").trim().slice(0, 2000),
      deepLink: input.deepLink || null,
      type: input.type || "info",
    }));
}
async function listStudentFeedback(db, uid) {
  const rows = await all(db, "SELECT * FROM feedback_threads WHERE firebase_uid=? ORDER BY updated_at DESC LIMIT 100", uid);
  return rows.map((r) => ({ ...r, lastMessageText: r.last_message_text || "", lastMessageAt: r.last_message_at || r.updated_at }));
}
function mapFeedbackMessage(row) {
  return { id: row.id, senderUid: row.sender_uid, senderRole: row.sender_role, text: row.text, createdAt: row.created_at, readAt: row.read_at, isRead: asBool(row.is_read) };
}
async function listFeedbackMessages(db, threadId) {
  return (await all(db, "SELECT * FROM feedback_messages WHERE thread_id=? ORDER BY created_at ASC LIMIT 250", threadId)).map(mapFeedbackMessage);
}
async function ensureFeedbackThread(db, user, input = {}) {
  let thread = await first(db, "SELECT * FROM feedback_threads WHERE id=? AND firebase_uid=?", input.threadId || "", user.uid);
  if (thread) return thread;
  const subject = String(input.subject || "").trim().slice(0, 160) || "Student feedback";
  const category = String(input.category || "general").trim().slice(0, 40);
  const id = uuid();
  const timestamp = now();
  await run(db, "INSERT INTO feedback_threads (id,firebase_uid,category,subject,status,last_message_text,last_message_at,unread_by_admin,unread_by_student,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    id, user.uid, category, subject, "open", "", timestamp, 0, 0, timestamp, timestamp);
  return await first(db, "SELECT * FROM feedback_threads WHERE id=?", id);
}

export async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin) && !new URL(origin).hostname.endsWith(".e2b.app")) {
    return fail("Origin not allowed.", 403);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": origin || "https://examcrack.pages.dev",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Vary": "Origin",
    }});
  }
  const path = (url.pathname.replace(/^\/api\/ec(?=\/|$)/, "") || "/").replace(/\/$/, "") || "/";
  try {
    const db = assertDb(env);
    if (path === "/health" && request.method === "GET") {
      const result = await first(db, "SELECT COUNT(*) AS tables_count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
      return json({ ok: true, service: "Exam Cracker D1 API", firebaseProjectId: FIREBASE_PROJECT_ID, storage: "cloudflare-d1", tables: Number(result?.tables_count || 0) });
    }
    if (path === "/public/site" && request.method === "GET") {
      const rows = await all(db, "SELECT key,published,published_at FROM site_settings");
      const config = {}, publishedAt = {};
      for (const row of rows) { config[row.key] = readJson(row.published, {}); publishedAt[row.key] = row.published_at || null; }
      return json({ config, publishedAt, degraded: false });
    }

    const user = await verifyFirebaseToken(request);
    const method = request.method.toUpperCase();
    const segments = path.split("/").filter(Boolean).map(decodeURIComponent);
    if (path === "/profile" && method === "GET") return json({ profile: await getProfile(db, user.uid) });
    if (path === "/profile" && (method === "POST" || method === "PATCH")) {
      const body = await readBody(request);
      const displayName = String(body.displayName || body.display_name || user.name || "").trim();
      const exam = String(body.exam || "").toUpperCase();
      const classLevel = String(body.classLevel || body.class_level || "");
      if (displayName.length < 2 || displayName.length > 80) return fail("Name must be 2-80 characters.");
      if (!["JEE", "NEET"].includes(exam) || !["11", "12"].includes(classLevel)) return fail("Choose JEE or NEET and class 11 or 12.");
      const timestamp = now();
      await run(db, "INSERT INTO student_profiles (firebase_uid,display_name,email,exam,class_level,avatar_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(firebase_uid) DO UPDATE SET display_name=excluded.display_name,email=excluded.email,exam=excluded.exam,class_level=excluded.class_level,avatar_url=excluded.avatar_url,updated_at=excluded.updated_at",
        user.uid, displayName, user.email || null, exam, classLevel, body.avatarUrl || user.picture || null, timestamp, timestamp);
      return json({ profile: await getProfile(db, user.uid) });
    }
    if (path === "/bootstrap" && method === "GET") {
      const profile = await getProfile(db, user.uid);
      if (!profile) return json({ needsOnboarding: true, profile: null, content: [], announcements: [], enrollments: [] });
      const content = (await contentRows(db, { activeOnly: true, exam: profile.exam, classLevel: profile.class_level })).filter(visibleBySchedule);
      const enrollmentRows = await all(db, "SELECT * FROM enrollments WHERE firebase_uid=? AND active=1 AND status='active' AND (expires_at IS NULL OR expires_at > ?)", user.uid, now());
      const announcements = (await all(db, "SELECT * FROM announcements WHERE active=1 ORDER BY created_at DESC LIMIT 50"))
        .filter((a) => (!a.scheduled_at || Date.parse(a.scheduled_at) <= Date.now()) && (a.audience === "All" || a.audience === profile.exam || String(a.audience).includes(profile.class_level)));
      return json({ needsOnboarding: false, profile, content: content.map((item) => mapCourse(item, false)), announcements, enrollments: enrollmentRows });
    }
    if (path === "/content" && method === "GET") {
      const profile = await getProfile(db, user.uid); requireProfile(profile);
      const kind = url.searchParams.get("kind") || "";
      const classLevel = url.searchParams.get("class") || profile.class_level;
      const exam = url.searchParams.get("exam") || profile.exam;
      const parentId = url.searchParams.get("parentId") || "";
      let items = await contentRows(db, { activeOnly: true, kind, exam, classLevel, parentId });
      if (parentId) {
        const parent = await first(db, "SELECT * FROM course_catalog WHERE id=?", parentId);
        const isPreview = items.some((item) => item.metadata.isPreview === true);
        if (!isPreview && parent && !await hasEnrollment(db, user.uid, parentId)) return fail("Enroll in this batch or series to access these lessons.", 403);
      }
      return json({ items: items.filter(visibleBySchedule).map((item) => mapCourse(item, false)) });
    }
    if (path === "/enrollments" && method === "POST") {
      const profile = await getProfile(db, user.uid); requireProfile(profile);
      const body = await readBody(request);
      const itemType = body.itemType === "series" ? "series" : "batch";
      const itemId = String(body.itemId || "");
      const item = await first(db, "SELECT * FROM course_catalog WHERE id=? AND kind=?", itemId, itemType);
      if (!item || !asBool(item.active)) return fail("This batch or series is unavailable.", 404);
      const course = mapCourse(item, true);
      const metadata = course.metadata || {};
      const needsCode = Boolean(item.access_code || metadata.requiresAccessCode || metadata.paid === true || metadata.isPaid === true);
      if (needsCode && (!body.accessCode || String(body.accessCode) !== String(item.access_code || ""))) {
        return fail("This content requires a valid access code or admin grant.", 402);
      }
      if (course.exam !== "Both" && course.exam !== profile.exam) return fail("This content is for a different exam track.", 403);
      if (!course.classes.includes(profile.class_level)) return fail("This content is not available for your class.", 403);
      const timestamp = now(), id = uuid();
      await run(db, "INSERT INTO enrollments (id,firebase_uid,item_type,item_id,active,status,source,metadata,created_at,updated_at) VALUES (?,?,?,?,1,'active',?,?,?,?) ON CONFLICT(firebase_uid,item_type,item_id) DO UPDATE SET active=1,status='active',source=excluded.source,revoked_at=NULL,updated_at=excluded.updated_at",
        id, user.uid, itemType, itemId, body.accessCode ? "access_code" : "self_service", "{}", timestamp, timestamp);
      const enrollment = await first(db, "SELECT * FROM enrollments WHERE firebase_uid=? AND item_type=? AND item_id=?", user.uid, itemType, itemId);
      await run(db, "INSERT INTO enrollment_events (id,enrollment_id,firebase_uid,item_type,item_id,action,source,actor_uid,actor_email,detail,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        uuid(), enrollment.id, user.uid, itemType, itemId, "granted", body.accessCode ? "access_code" : "self_service", user.uid, user.email, "{}", timestamp);
      return json({ enrolled: true, enrollment });
    }
    if (path === "/progress" && method === "POST") {
      const profile = await getProfile(db, user.uid); requireProfile(profile);
      const body = await readBody(request), lectureId = String(body.lectureId || "");
      if (!lectureId) return fail("Lecture is required.");
      const watched = Math.max(0, Math.min(86400, Math.round(Number(body.watchedSeconds) || 0)));
      const completed = body.completed === true ? 1 : 0, timestamp = now(), id = uuid();
      await run(db, "INSERT INTO lesson_progress (id,firebase_uid,lecture_id,watched_seconds,completed,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(firebase_uid,lecture_id) DO UPDATE SET watched_seconds=MAX(lesson_progress.watched_seconds,excluded.watched_seconds),completed=MAX(lesson_progress.completed,excluded.completed),updated_at=excluded.updated_at",
        id, user.uid, lectureId, watched, completed, timestamp);
      return json({ progress: await first(db, "SELECT * FROM lesson_progress WHERE firebase_uid=? AND lecture_id=?", user.uid, lectureId) });
    }
    if (path === "/tests" && method === "GET") {
      const profile = await getProfile(db, user.uid); requireProfile(profile);
      const items = await contentRows(db, { activeOnly: true, kind: "test", exam: profile.exam, classLevel: profile.class_level });
      return json({ items: items.filter(visibleBySchedule).map((item) => mapCourse(item, false)) });
    }
    if (segments[0] === "tests" && segments.length === 2 && method === "GET") {
      const profile = await getProfile(db, user.uid); requireProfile(profile);
      const row = await first(db, "SELECT * FROM course_catalog WHERE id=? AND kind='test' AND active=1", segments[1]);
      if (!row) return fail("Test not found.", 404);
      const test = mapCourse(row, true);
      if (test.exam !== "Both" && test.exam !== profile.exam) return fail("Test is not available for your exam.", 403);
      if (!test.classes.includes(profile.class_level)) return fail("Test is not available for your class.", 403);
      const prior = await first(db, "SELECT id FROM exam_attempts WHERE firebase_uid=? AND test_id=? ORDER BY submitted_at DESC LIMIT 1", user.uid, test.id);
      if (prior) return fail("You have already submitted this test.", 409);
      const questions = Array.isArray(test.metadata.questions) ? test.metadata.questions.map(redactQuestion) : [];
      return json({ test: mapCourse(row, false), questions });
    }
    if (segments[0] === "tests" && segments.length === 3 && segments[2] === "submit" && method === "POST") {
      const profile = await getProfile(db, user.uid); requireProfile(profile);
      const testId = segments[1], body = await readBody(request);
      const row = await first(db, "SELECT * FROM course_catalog WHERE id=? AND kind='test' AND active=1", testId);
      if (!row) return fail("Test not found.", 404);
      const test = mapCourse(row, true);
      if ((test.exam !== "Both" && test.exam !== profile.exam) || !test.classes.includes(profile.class_level)) return fail("Test is not available for your exam and class.", 403);
      const prior = await first(db, "SELECT id FROM exam_attempts WHERE firebase_uid=? AND test_id=? LIMIT 1", user.uid, testId);
      if (prior) return fail("This test has already been submitted.", 409);
      if (!visibleBySchedule(test)) return fail("This test is not open for submissions.", 409);
      const result = scoreTest(test, body.answers && typeof body.answers === "object" ? body.answers : {});
      const attemptId = uuid(), timestamp = now();
      const reviewPayload = result.review.map((item) => ({ ...item }));
      await run(db, "INSERT INTO exam_attempts (id,firebase_uid,test_id,exam,class_level,score,max_score,correct_count,incorrect_count,unanswered_count,answers,submitted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        attemptId, user.uid, testId, profile.exam, profile.class_level, result.score, result.maxScore, result.correct, result.incorrect, result.unanswered, JSON.stringify({ submittedAnswers: body.answers || {}, review: reviewPayload }), timestamp);
      const attempt = await first(db, "SELECT * FROM exam_attempts WHERE id=?", attemptId);
      return json({
        attempt: parseAttempt(attempt),
        result: { score: result.score, maxScore: result.maxScore, correctCount: result.correct, incorrectCount: result.incorrect, unansweredCount: result.unanswered, totalQuestions: result.questionsCount },
        review: reviewPayload,
      });
    }
    if (segments[0] === "tests" && segments.length === 3 && segments[2] === "result" && method === "GET") {
      const testId = segments[1];
      const attempt = parseAttempt(await first(db, "SELECT * FROM exam_attempts WHERE firebase_uid=? AND test_id=? ORDER BY submitted_at DESC LIMIT 1", user.uid, testId));
      if (!attempt) return fail("No submitted result was found.", 404);
      const saved = attempt.answers && typeof attempt.answers === "object" ? attempt.answers : {};
      const review = Array.isArray(saved.review) ? saved.review : [];
      return json({ attempt, result: { score: attempt.score, maxScore: attempt.max_score, correctCount: attempt.correct_count, incorrectCount: attempt.incorrect_count, unansweredCount: attempt.unanswered_count, totalQuestions: review.length }, review });
    }
    if (path === "/leaderboard" && method === "GET") {
      const testId = url.searchParams.get("testId");
      if (!testId) return json({ testId: null, items: [] });
      const profile = await getProfile(db, user.uid); requireProfile(profile);
      const items = await all(db, "SELECT e.firebase_uid,e.score,e.max_score,e.correct_count,e.submitted_at,p.display_name FROM exam_attempts e LEFT JOIN student_profiles p ON p.firebase_uid=e.firebase_uid WHERE e.test_id=? AND e.exam=? AND e.class_level=? ORDER BY e.score DESC,e.submitted_at ASC LIMIT 100", testId, profile.exam, profile.class_level);
      return json({ testId, items: items.map((item, index) => ({ ...item, rank: index + 1, name: item.firebase_uid === user.uid ? (profile.display_name || "You") : (item.display_name || "Student"), isCurrentUser: item.firebase_uid === user.uid })) });
    }
    if (path === "/analysis" && method === "GET") {
      const profile = await getProfile(db, user.uid); requireProfile(profile);
      const attempts = await all(db, "SELECT * FROM exam_attempts WHERE firebase_uid=? ORDER BY submitted_at DESC LIMIT 100", user.uid);
      const progress = await all(db, "SELECT * FROM lesson_progress WHERE firebase_uid=?", user.uid);
      const average = attempts.length ? attempts.reduce((sum, x) => sum + Number(x.score || 0), 0) / attempts.length : 0;
      const watchSeconds = progress.reduce((sum, x) => sum + Number(x.watched_seconds || 0), 0);
      return json({ profile, counts: { testsTaken: attempts.length, lessonsStarted: progress.length, lessonsCompleted: progress.filter((x) => asBool(x.completed)).length, watchSeconds }, stats: { testsTaken: attempts.length, averageScore: average, totalScore: attempts.reduce((sum, x) => sum + Number(x.score || 0), 0), watchSeconds }, attempts, progress, level: attempts.length < 3 ? "Beginner" : attempts.length < 10 ? "Consistent" : "Dedicated" });
    }

    if (segments[0] === "feedback") {
      const threadId = segments[1] || "";
      if (method === "GET" && !threadId) return json({ items: await listStudentFeedback(db, user.uid) });
      if (method === "POST" && !threadId) {
        const body = await readBody(request);
        const messageText = String(body.message || body.text || "").trim();
        if (messageText.length < 3 || messageText.length > 5000) return fail("Feedback must be between 3 and 5000 characters.");
        // A separate D1 feedback ticket is created for each submission.
        const timestamp = now();
        const actualId = uuid();
        await run(db, "INSERT INTO feedback_threads (id,firebase_uid,category,subject,status,last_message_text,last_message_at,unread_by_admin,unread_by_student,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          actualId, user.uid, String(body.category || "general").slice(0, 40), String(body.subject || "Student feedback").trim().slice(0,160) || "Student feedback", "open", messageText.slice(0, 200), timestamp, 1, 0, timestamp, timestamp);
        await run(db, "INSERT INTO feedback_messages (id,thread_id,sender_uid,sender_role,text,created_at,is_read,payload) VALUES (?,?,?,?,?,?,0,?)",
          uuid(), actualId, user.uid, "student", messageText, timestamp, JSON.stringify({ attachments: Array.isArray(body.attachments) ? body.attachments.slice(0,5) : [] }));
        return json({ item: await first(db, "SELECT * FROM feedback_threads WHERE id=?", actualId) }, 201);
      }
      if (method === "GET" && threadId) {
        const thread = await first(db, "SELECT * FROM feedback_threads WHERE id=? AND firebase_uid=?", threadId, user.uid);
        if (!thread) return fail("Feedback item not found.", 404);
        await run(db, "UPDATE feedback_messages SET is_read=1,read_at=? WHERE thread_id=? AND sender_role='admin' AND is_read=0", now(), threadId);
        await run(db, "UPDATE feedback_threads SET unread_by_student=0 WHERE id=?", threadId);
        return json({ item: thread, messages: await listFeedbackMessages(db, threadId) });
      }
      if (method === "POST" && threadId && segments[2] === "messages") {
        const thread = await first(db, "SELECT * FROM feedback_threads WHERE id=? AND firebase_uid=?", threadId, user.uid);
        if (!thread) return fail("Feedback item not found.", 404);
        const body = await readBody(request), text = String(body.message || body.text || "").trim();
        if (text.length < 1 || text.length > 5000) return fail("Message must be between 1 and 5000 characters.");
        const timestamp=now();
        await run(db, "INSERT INTO feedback_messages (id,thread_id,sender_uid,sender_role,text,created_at,is_read,payload) VALUES (?,?,?,?,?,?,0,?)",
          uuid(), threadId, user.uid, "student", text, timestamp, "{}");
        await run(db, "UPDATE feedback_threads SET status=CASE WHEN status='resolved' THEN 'open' ELSE status END,last_message_text=?,last_message_at=?,unread_by_admin=1,updated_at=? WHERE id=?",
          text.slice(0,200), timestamp, timestamp, threadId);
        return json({ messages: await listFeedbackMessages(db, threadId) }, 201);
      }
    }

    if (path === "/notifications" && method === "GET") {
      const rows = await all(db, "SELECT * FROM notifications WHERE firebase_uid=? ORDER BY created_at DESC LIMIT 100", user.uid);
      return json({ items: rows.map((r) => ({ id:r.id, ...readJson(r.payload, {}), createdAt:r.created_at, isRead:asBool(r.is_read), readAt:r.read_at || null })) });
    }
    if (segments[0] === "notifications" && segments.length === 2 && method === "PATCH") {
      const result = await run(db, "UPDATE notifications SET is_read=1,read_at=? WHERE id=? AND firebase_uid=?", now(), segments[1], user.uid);
      return json({ updated: true });
    }
    if (path === "/broadcasts" && method === "GET") {
      const profile = await getProfile(db, user.uid);
      const rows = await all(db, "SELECT * FROM broadcasts WHERE active=1 ORDER BY created_at DESC LIMIT 50");
      return json({ items: rows.map((r) => ({ id:r.id, ...readJson(r.payload, {}), active:true, createdAt:r.created_at })).filter((item) => !profile || (!item.exam || item.exam === "Both" || item.exam === profile.exam) && (!item.classes || item.classes.includes(profile.class_level))) });
    }
    if (path === "/push-tokens" && method === "POST") {
      const body = await readBody(request), token = String(body.token || "");
      if (!token || token.length > 4096) return fail("Invalid push token.");
      await run(db, "INSERT INTO push_tokens (id,firebase_uid,token,created_at,payload) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET token=excluded.token,created_at=excluded.created_at,payload=excluded.payload",
        user.uid + ":" + token.slice(0,40), user.uid, token, now(), JSON.stringify({ platform: body.platform || "web" }));
      return json({ saved: true });
    }

    if (path === "/library" && method === "GET") {
      const rows = await all(db, "SELECT * FROM student_library WHERE firebase_uid=? ORDER BY updated_at DESC LIMIT 300", user.uid);
      return json({ items: rows.map((r) => ({ ...r, payload: readJson(r.payload, {}) })) });
    }
    if (path === "/library" && method === "POST") {
      const body = await readBody(request), itemType = String(body.itemType || ""), itemId = String(body.itemId || "");
      if (!["bookmark", "note", "recent", "challenge", "revision"].includes(itemType) || !itemId || itemId.length > 240) return fail("Invalid library item.");
      const timestamp = now(), id = uuid();
      await run(db, "INSERT INTO student_library (id,firebase_uid,item_type,item_id,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(firebase_uid,item_type,item_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at",
        id, user.uid, itemType, itemId, JSON.stringify(body.payload || {}), timestamp, timestamp);
      return json({ item: await first(db, "SELECT * FROM student_library WHERE firebase_uid=? AND item_type=? AND item_id=?", user.uid, itemType, itemId) });
    }
    if (segments[0] === "library" && segments.length === 3 && method === "DELETE") {
      await run(db, "DELETE FROM student_library WHERE firebase_uid=? AND item_type=? AND item_id=?", user.uid, segments[1], segments[2]);
      return json({ removed: true });
    }

    if (segments[0] === "admin") {
      requireAdmin(user);
      if (path === "/admin/overview" && method === "GET") {
        const counts = {};
        for (const [key, table, where] of [
          ["students","student_profiles",""],["content","course_catalog",""],["active_content","course_catalog"," WHERE active=1"],
          ["tests","course_catalog"," WHERE kind='test'"],["announcements","announcements",""],["attempts","exam_attempts",""],["enrollments","enrollments"," WHERE active=1"],
          ["feedback","feedback_threads"," WHERE status!='resolved'"]
        ]) counts[key] = Number((await first(db, "SELECT COUNT(*) AS n FROM "+table+where))?.n || 0);
        const latestContent = (await all(db, "SELECT * FROM course_catalog ORDER BY created_at DESC LIMIT 8")).map((x)=>mapCourse(x,true));
        const latestActivity = await all(db, "SELECT * FROM admin_activity ORDER BY created_at DESC LIMIT 8");
        return json({ counts, latestContent, latestActivity });
      }
      if (segments[1] === "students" && method === "GET") {
        const q = (url.searchParams.get("query") || "").trim().toLowerCase();
        const exam = url.searchParams.get("exam") || "", cl = url.searchParams.get("class") || "";
        const page = Math.max(1, Number(url.searchParams.get("page") || 1)), pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 25)));
        let items = await all(db, "SELECT * FROM student_profiles ORDER BY created_at DESC");
        items = items.filter((x)=>(!q || String(x.display_name||"").toLowerCase().includes(q) || String(x.email||"").toLowerCase().includes(q) || x.firebase_uid.toLowerCase().includes(q)) && (!exam || x.exam===exam) && (!cl || x.class_level===cl));
        return json({ items: items.slice((page-1)*pageSize,page*pageSize).map(mapProfile), total: items.length, page, pageSize, totalPages: Math.ceil(items.length/pageSize) });
      }
      if (segments[1] === "content" && method === "GET") {
        const items = await contentRows(db, { kind:url.searchParams.get("kind")||"",exam:url.searchParams.get("exam")||"",classLevel:url.searchParams.get("class")||"" });
        return json({ items });
      }
      if (path === "/admin/content" && method === "POST") {
        const body = await readBody(request), p = coursePayload(body), id = uuid(), timestamp=now();
        await run(db, "INSERT INTO course_catalog (id,kind,title,description,exam,classes,active,access_code,metadata,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          id,p.kind,p.title,p.description,p.exam,JSON.stringify(p.classes),p.active?1:0,p.accessCode,JSON.stringify(p.metadata),timestamp,timestamp);
        await activity(db,user,"content.create",p.kind,id,p.title,{exam:p.exam});
        return json({ item: mapCourse(await first(db,"SELECT * FROM course_catalog WHERE id=?",id),true) },201);
      }
      if (segments[1] === "content" && segments.length === 3 && (method === "PATCH" || method === "DELETE")) {
        const id=segments[2], current=await first(db,"SELECT * FROM course_catalog WHERE id=?",id);
        if(!current) return fail("Content not found.",404);
        if(method==="DELETE") {
          await run(db,"UPDATE course_catalog SET active=0,updated_at=? WHERE id=?",now(),id);
          await activity(db,user,"content.disable",current.kind,id,current.title);
          return json({item:{id,kind:current.kind,title:current.title,active:false},disabled:true});
        }
        const body=await readBody(request), old=mapCourse(current,true), merged=coursePayload({...old,...body,classes:body.classes||old.classes,metadata:body.metadata||old.metadata,accessCode:body.accessCode===undefined?old.access_code:body.accessCode});
        await run(db,"UPDATE course_catalog SET kind=?,title=?,description=?,exam=?,classes=?,active=?,access_code=?,metadata=?,updated_at=? WHERE id=?",
          merged.kind,merged.title,merged.description,merged.exam,JSON.stringify(merged.classes),merged.active?1:0,merged.accessCode,JSON.stringify(merged.metadata),now(),id);
        await activity(db,user,"content.update",merged.kind,id,merged.title);
        return json({item:mapCourse(await first(db,"SELECT * FROM course_catalog WHERE id=?",id),true)});
      }
      if (path === "/admin/announcements" && method === "GET") return json({items:await all(db,"SELECT * FROM announcements ORDER BY created_at DESC LIMIT 200").then(rows=>rows.map(x=>({...x,active:asBool(x.active)})))});
      if (path === "/admin/announcements" && method === "POST") {
        const b=await readBody(request), title=String(b.title||"").trim(), body=String(b.body||"").trim();
        if(!title||!body) return fail("Title and message are required.");
        const id=uuid(), timestamp=now();
        await run(db,"INSERT INTO announcements (id,title,body,audience,active,scheduled_at,created_at) VALUES (?,?,?,?,?,?,?)",id,title.slice(0,180),body.slice(0,12000),String(b.audience||"All"),b.active?1:0,b.scheduledAt||null,timestamp);
        await activity(db,user,"announcement.create","announcement",id,title);
        return json({item:await first(db,"SELECT * FROM announcements WHERE id=?",id)},201);
      }
      if (segments[1] === "announcements" && segments.length === 3 && method === "PATCH") {
        const id=segments[2], b=await readBody(request), current=await first(db,"SELECT * FROM announcements WHERE id=?",id);
        if(!current) return fail("Announcement not found.",404);
        await run(db,"UPDATE announcements SET title=?,body=?,audience=?,active=?,scheduled_at=? WHERE id=?",String(b.title??current.title),String(b.body??current.body),String(b.audience??current.audience),b.active===undefined?current.active:(b.active?1:0),b.scheduledAt===undefined?current.scheduled_at:b.scheduledAt,id);
        return json({item:await first(db,"SELECT * FROM announcements WHERE id=?",id)});
      }
      if (path === "/admin/site-settings" && method === "GET") {
        const rows=await all(db,"SELECT * FROM site_settings ORDER BY key");
        return json({items:rows.map((x)=>({...x,draft:readJson(x.draft,{}),published:readJson(x.published,{})}))});
      }
      if (segments[1] === "site-settings" && segments.length === 3 && method === "PATCH") {
        const key=segments[2], b=await readBody(request), current=await first(db,"SELECT * FROM site_settings WHERE key=?",key);
        if(!b.draft || typeof b.draft!=="object") return fail("Draft must be a JSON object.");
        const draft=JSON.stringify(b.draft);
        if(draft.length>MAX_BODY_BYTES) return fail("Setting is too large.",413);
        const timestamp=now();
        await run(db,"INSERT INTO site_settings (key,draft,published,published_at,updated_at,updated_by) VALUES (?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET draft=excluded.draft,updated_at=excluded.updated_at,updated_by=excluded.updated_by",
          key,draft,current?.published||"{}",current?.published_at||null,timestamp,user.email);
        await activity(db,user,"site_setting.draft","site_setting",key,"Saved draft");
        return json({item:await first(db,"SELECT * FROM site_settings WHERE key=?",key).then((x)=>({...x,draft:readJson(x.draft,{}),published:readJson(x.published,{})}))});
      }
      if (segments[1] === "site-settings" && segments.length === 4 && segments[3] === "publish" && method === "POST") {
        const key=segments[2], current=await first(db,"SELECT * FROM site_settings WHERE key=?",key);
        if(!current) return fail("Setting draft not found.",404);
        const timestamp=now();
        await run(db,"UPDATE site_settings SET published=draft,published_at=?,updated_at=?,updated_by=? WHERE key=?",timestamp,timestamp,user.email,key);
        await activity(db,user,"site_setting.publish","site_setting",key,"Published setting");
        const item=await first(db,"SELECT * FROM site_settings WHERE key=?",key);
        return json({item:{...item,draft:readJson(item.draft,{}),published:readJson(item.published,{})}});
      }
      if (segments[1] === "site-settings" && segments.length === 3 && method === "DELETE") {
        await run(db,"DELETE FROM site_settings WHERE key=?",segments[2]);
        await activity(db,user,"site_setting.reset","site_setting",segments[2],"Reset setting to code defaults");
        return json({reset:true});
      }
      if (path === "/admin/activity" && method === "GET") {
        const limitN=Math.min(250,Math.max(1,Number(url.searchParams.get("limit")||100)));
        return json({items:await all(db,"SELECT * FROM admin_activity ORDER BY created_at DESC LIMIT ?",limitN)});
      }
      if (path === "/admin/analytics" && method === "GET") {
        const attempts=await all(db,"SELECT score,max_score,correct_count,incorrect_count,submitted_at,test_id FROM exam_attempts ORDER BY submitted_at DESC LIMIT 1000");
        const top=await all(db,"SELECT p.firebase_uid,p.display_name,p.exam,p.class_level,COUNT(a.id) AS attempts,AVG(a.score) AS avg_score FROM student_profiles p LEFT JOIN exam_attempts a ON a.firebase_uid=p.firebase_uid GROUP BY p.firebase_uid ORDER BY avg_score DESC LIMIT 10");
        return json({attempts:attempts.length,totalAttempts:attempts.length,averageScore:attempts.length?attempts.reduce((s,x)=>s+Number(x.score||0),0)/attempts.length:0,topStudents:top,trend:[]});
      }
      if (path === "/admin/enrollments" && method === "GET") {
        const status=url.searchParams.get("status")||"active", q=(url.searchParams.get("query")||"").toLowerCase(), itemId=url.searchParams.get("itemId")||"", itemType=url.searchParams.get("itemType")||"";
        const page=Math.max(1,Number(url.searchParams.get("page")||1)),pageSize=Math.min(100,Math.max(1,Number(url.searchParams.get("pageSize")||25)));
        let items=await all(db,"SELECT e.*,p.display_name,p.email,c.title AS item_title FROM enrollments e LEFT JOIN student_profiles p ON p.firebase_uid=e.firebase_uid LEFT JOIN course_catalog c ON c.id=e.item_id ORDER BY e.updated_at DESC");
        items=items.filter((x)=>(status==="all"||x.status===status||(!x.status&&status==="active"&&asBool(x.active)))&&(!itemId||x.item_id===itemId)&&(!itemType||x.item_type===itemType)&&(!q||String(x.display_name||"").toLowerCase().includes(q)||String(x.email||"").toLowerCase().includes(q)||String(x.item_title||"").toLowerCase().includes(q)||x.firebase_uid.toLowerCase().includes(q)));
        const allRows=await all(db,"SELECT status,COUNT(*) AS n FROM enrollments GROUP BY status");
        const counts={active:0,revoked:0,total:0}; for(const r of allRows){counts[r.status||"active"]=Number(r.n);counts.total+=Number(r.n);}
        return json({items:items.slice((page-1)*pageSize,page*pageSize),total:items.length,page,pageSize,counts});
      }
      if (path === "/admin/enrollments" && method === "POST") {
        const b=await readBody(request); const item=await first(db,"SELECT * FROM course_catalog WHERE id=? AND kind=?",String(b.itemId||""),String(b.itemType||""));
        if(!item) return fail("Batch or series not found.",404);
        const profile=await getProfile(db,String(b.studentUid||""));
        if(!profile) return fail("Student profile not found.",404);
        const id=uuid(),timestamp=now();
        await run(db,"INSERT INTO enrollments (id,firebase_uid,item_type,item_id,active,status,source,granted_by,expires_at,created_at,updated_at,metadata) VALUES (?,?,?, ?,1,'active','manual',?,?,?,?,'{}') ON CONFLICT(firebase_uid,item_type,item_id) DO UPDATE SET active=1,status='active',source='manual',granted_by=excluded.granted_by,expires_at=excluded.expires_at,updated_at=excluded.updated_at",
          id,profile.firebase_uid,b.itemType,b.itemId,user.uid,b.expiresAt||null,timestamp,timestamp);
        const row=await first(db,"SELECT * FROM enrollments WHERE firebase_uid=? AND item_type=? AND item_id=?",profile.firebase_uid,b.itemType,b.itemId);
        await activity(db,user,"enrollment.grant","enrollment",row.id,"Granted course access",{studentUid:profile.firebase_uid,itemId:b.itemId});
        return json({item:row},201);
      }
      if (path === "/admin/enrollments/bulk" && method === "POST") {
        const b=await readBody(request); const item=await first(db,"SELECT * FROM course_catalog WHERE id=? AND kind=?",String(b.itemId||""),String(b.itemType||""));
        if(!item) return fail("Batch or series not found.",404);
        let students=await all(db,"SELECT * FROM student_profiles");
        if(b.mode==="selected") { const chosen=new Set((b.studentUids||[]).slice(0,500)); students=students.filter((s)=>chosen.has(s.firebase_uid)); }
        else if(b.mode==="filter"||b.exam||b.classLevel) students=students.filter((s)=>(!b.exam||s.exam===b.exam)&&(!b.classLevel||s.class_level===b.classLevel));
        if(students.length>500&&!b.dryRun) return fail("Audience is too large; narrow the filter or process in smaller batches.",409);
        if((b.mode==="all"||b.mode==="filter")&&!b.confirmAll&&!b.dryRun) return json({error:"CONFIRMATION_REQUIRED",message:"Confirm the resolved audience before granting access.",total:students.length},409);
        if(b.dryRun) return json({dryRun:true,total:students.length,eligible:students.length,created:0,skipped:0,failed:0});
        const timestamp=now();
        const statements=students.map((p)=>db.prepare("INSERT INTO enrollments (id,firebase_uid,item_type,item_id,active,status,source,granted_by,expires_at,created_at,updated_at,metadata) VALUES (?,?,?, ?,1,'active','admin_bulk',?,?,?,?,'{}') ON CONFLICT(firebase_uid,item_type,item_id) DO UPDATE SET active=1,status='active',source='admin_bulk',granted_by=excluded.granted_by,expires_at=excluded.expires_at,updated_at=excluded.updated_at").bind(uuid(),p.firebase_uid,b.itemType,b.itemId,user.uid,b.expiresAt||null,timestamp,timestamp));
        for(let i=0;i<statements.length;i+=100) await batch(db,statements.slice(i,i+100));
        await activity(db,user,"enrollment.bulk","enrollment",String(b.itemId),"Bulk enrollment",{students:students.length,itemType:b.itemType});
        return json({created:students.length,reactivated:0,skipped:0,failed:0,total:students.length});
      }
      if (path === "/admin/enrollments/bulk-revoke" && method === "POST") {
        const b=await readBody(request); if(b.confirm!=="REVOKE") return fail("Explicit revoke confirmation required.",400);
        const uids=Array.isArray(b.studentUids)?b.studentUids.slice(0,500):[];
        let revoked=0;
        for(let i=0;i<uids.length;i+=100) {
          const stmts=uids.slice(i,i+100).map((uid)=>db.prepare("UPDATE enrollments SET active=0,status='revoked',revoked_at=?,updated_at=? WHERE firebase_uid=? AND item_type=? AND item_id=? AND active=1").bind(now(),now(),uid,b.itemType,b.itemId));
          const result=await batch(db,stmts); revoked+=result.reduce((sum,r)=>sum+Number(r.meta?.changes||0),0);
        }
        return json({revoked,failed:Math.max(0,uids.length-revoked)});
      }
      if (segments[1] === "enrollments" && segments.length === 3 && method === "DELETE") {
        await run(db,"UPDATE enrollments SET active=0,status='revoked',revoked_at=?,updated_at=? WHERE id=?",now(),now(),segments[2]);
        return json({removed:true});
      }
      if (segments[1] === "enrollments" && segments.length === 4 && segments[3] === "restore" && method === "POST") {
        const b=await readBody(request),id=segments[2];
        await run(db,"UPDATE enrollments SET active=1,status='active',revoked_at=NULL,updated_at=? WHERE id=?",now(),id);
        return json({item:await first(db,"SELECT * FROM enrollments WHERE id=?",id)});
      }
      if ((path === "/admin/enrollment-history" || path === "/admin/enrollments/history") && method === "GET") {\n        const limitN=Math.min(500,Math.max(1,Number(url.searchParams.get("limit")||120)));\n        return json({items:await all(db,"SELECT * FROM enrollment_events ORDER BY created_at DESC LIMIT ?",limitN)});\n      }
      if (path === "/admin/enrollment-rules" && method === "GET") return json({items:await all(db,"SELECT * FROM enrollment_rules ORDER BY created_at DESC")});
      if (segments[1] === "enrollment-rules" && segments.length === 3 && method === "PATCH") {
        const b=await readBody(request); await run(db,"UPDATE enrollment_rules SET active=?,updated_at=? WHERE id=?",b.active?1:0,now(),segments[2]);
        return json({item:await first(db,"SELECT * FROM enrollment_rules WHERE id=?",segments[2])});
      }
      if (segments[1] === "enrollment-rules" && segments.length === 3 && method === "DELETE") {
        await run(db,"DELETE FROM enrollment_rules WHERE id=?",segments[2]); return json({removed:true});
      }
      if (path === "/admin/feedback" && method === "GET") {
        const rows=await all(db,"SELECT f.*,p.display_name,p.email,p.exam,p.class_level FROM feedback_threads f LEFT JOIN student_profiles p ON p.firebase_uid=f.firebase_uid ORDER BY f.updated_at DESC LIMIT 300");
        return json({items:rows});
      }
      if (segments[1] === "feedback" && segments.length === 3 && method === "GET") {
        const item=await first(db,"SELECT f.*,p.display_name,p.email,p.exam,p.class_level FROM feedback_threads f LEFT JOIN student_profiles p ON p.firebase_uid=f.firebase_uid WHERE f.id=?",segments[2]);
        if(!item) return fail("Feedback not found.",404);
        return json({item,messages:await listFeedbackMessages(db,segments[2])});
      }
      if (segments[1] === "feedback" && segments.length === 4 && segments[3] === "reply" && method === "POST") {
        const id=segments[2], b=await readBody(request), text=String(b.message||b.text||"").trim();
        const item=await first(db,"SELECT * FROM feedback_threads WHERE id=?",id);
        if(!item) return fail("Feedback not found.",404);
        if(text.length<1||text.length>5000) return fail("Reply must be between 1 and 5000 characters.");
        const timestamp=now();
        await run(db,"INSERT INTO feedback_messages (id,thread_id,sender_uid,sender_role,text,created_at,is_read,read_at,payload) VALUES (?,?,?,?,?,?,0,NULL,'{}')",uuid(),id,user.uid,"admin",text,timestamp);
        await run(db,"UPDATE feedback_threads SET status='in_progress',last_message_text=?,last_message_at=?,unread_by_student=1,updated_at=? WHERE id=?",text.slice(0,200),timestamp,timestamp,id);
        await activity(db,user,"feedback.reply","feedback",id,"Replied to student feedback");
        await logNotification(db,item.firebase_uid,{title:"Feedback response",body:text.slice(0,500),deepLink:"/feedback",type:"feedback"});
        return json({item:await first(db,"SELECT * FROM feedback_threads WHERE id=?",id),messages:await listFeedbackMessages(db,id)});
      }
      if (segments[1] === "feedback" && segments.length === 3 && method === "PATCH") {
        const b=await readBody(request), id=segments[2];
        if (b.markRead === true) {
          await run(db,"UPDATE feedback_messages SET is_read=1,read_at=? WHERE thread_id=? AND sender_role='student' AND is_read=0",now(),id);
          await run(db,"UPDATE feedback_threads SET unread_by_admin=0 WHERE id=?",id);
          return json({item:await first(db,"SELECT * FROM feedback_threads WHERE id=?",id)});
        }
        const status=String(b.status||"");
        if(!["open","in_progress","resolved"].includes(status)) return fail("Invalid feedback status.");
        await run(db,"UPDATE feedback_threads SET status=?,updated_at=? WHERE id=?",status,now(),id);
        await activity(db,user,"feedback.status","feedback",id,"Changed feedback status",{status});
        return json({item:await first(db,"SELECT * FROM feedback_threads WHERE id=?",id)});
      }
      if (path === "/admin/notifications" && method === "POST") {
        const b=await readBody(request),uids=Array.isArray(b.studentUids)?b.studentUids.slice(0,500):[];
        const input=b.input&&typeof b.input==="object"?b.input:b;
        let sent=0,failed=[];
        for(let i=0;i<uids.length;i+=100) {
          const sub=uids.slice(i,i+100),timestamp=now();
          const statements=sub.map((uid)=>db.prepare("INSERT INTO notifications (id,firebase_uid,is_read,created_at,payload) VALUES (?,?,?,?,?)").bind(uuid(),uid,0,timestamp,JSON.stringify({title:String(input.title||"").slice(0,160),body:String(input.body||"").slice(0,2000),deepLink:input.deepLink||null,type:input.type||"info"})));
          try { await batch(db,statements); sent+=sub.length; } catch { failed.push(...sub); }
        }
        return json({sent,failed});
      }
    }
    return fail("Endpoint not found.", 404);
  } catch (error) {
    const status = Number(error && error.status) || 500;
    const message = status >= 500 ? "Exam Cracker server error. Please retry." : String(error.message || "Request failed.");
    return fail(message, status, status >= 500 ? undefined : error.message);
  }
}

export default {
  async fetch(request, env) {
    return handleApiRequest(request, env);
  },
};
