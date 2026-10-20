import { createClient } from "npm:@supabase/supabase-js@2";
import {
  enrollmentIsActive,
  isEligibleForItem,
  isPaidItem,
} from "../_shared/enrollment-core.ts";

const FIREBASE_PROJECT_ID = "darvo1";
const ADMIN_EMAIL = (Deno.env.get("ADMIN_EMAIL") || "arvinddarabishnoi@gmail.com").toLowerCase();
const MAX_BODY_BYTES = 512 * 1024;
const ALLOWED_EXAMS = new Set(["JEE", "NEET", "Both"]);
const ALLOWED_KINDS = new Set(["batch", "series", "lecture", "resource", "event", "goal", "test"]);
const SITE_SETTING_KEYS = ["theme", "login", "homepage", "navigation", "footer", "banners", "popups", "testimonials", "challenges", "features", "seo", "media"];
const LIBRARY_ITEM_TYPES = new Set(["bookmark", "note", "recent", "challenge", "revision"]);
const MAX_SETTING_BYTES = 512 * 1024;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400"
};
/**
 * Browser-origin allowlist. Requests without an Origin header (curl, server
 * jobs, native apps) are allowed; unknown browser origins are refused before
 * any data is read. Keep the production worker and local dev origins here and
 * add custom domains through the ALLOWED_ORIGINS secret.
 */
const DEFAULT_ALLOWED_ORIGINS = [
  "https://exam-cracker-web.arvinddara0290.workers.dev",
  "http://localhost:3000",
  "http://localhost:8787",
  "http://127.0.0.1:3000",
];
function allowedOrigins() {
  const extra = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...extra]);
}
function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins().has(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    // Sandbox/preview hosts used while reviewing the app.
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host.endsWith(".e2b.app")) return true;
  } catch {
    return false;
  }
  return false;
}

/**
 * Best-effort per-isolate rate limiting (Supabase runs many isolates, so this
 * stops accidental loops and casual abuse rather than guaranteeing a global
 * quota). Wider protection belongs at the CDN/WAF layer.
 */
const rateBuckets = new Map();
function rateLimited(key, limit, windowMs) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    rateBuckets.set(key, { start: now, count: 1 });
    if (rateBuckets.size > 5000) rateBuckets.clear();
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}
const RATE_LIMITED_BODY = { error: "Too many requests. Please wait a moment and try again." };

let cachedJwks = null;
let cachedJwksExpiresAt = 0;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: "Origin not allowed." }), {
      status: 403,
      headers: Object.assign({}, CORS_HEADERS, { "Content-Type": "application/json; charset=utf-8", Vary: "Origin" }),
    });
  }
  if (req.method === "OPTIONS") return new Response("ok", { headers: Object.assign({}, CORS_HEADERS, { Vary: "Origin" }) });
  const url = new URL(req.url);
  if (url.pathname.endsWith("/health") || url.pathname === "/health") {
    return json({ ok: true, service: "Exam Cracker API", firebaseProjectId: FIREBASE_PROJECT_ID }, 200);
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || getDefaultSecretKey();
    if (!supabaseUrl || !serviceKey) throw new Error("Server database credentials are not configured.");
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const path = normalizePath(url.pathname);
    const method = req.method.toUpperCase();

    // Public, read-only published site configuration. Required so the login
    // page can render the admin-designed appearance before a user signs in.
    // Only values explicitly published by an admin are exposed.
    if (path === "/public/site" && method === "GET") {
      return await publicSitePayload(db);
    }

    const claims = await requireFirebaseUser(req);
    const isAdmin = String(claims.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();

    if (path === "/profile" && method === "GET") {
      const { data, error } = await db.from("student_profiles").select("*").eq("firebase_uid", claims.sub).maybeSingle();
      if (error) throw error;
      return json({ profile: data || null });
    }
    if (path === "/profile" && (method === "POST" || method === "PATCH")) {
      const body = await bodyJson(req);
      const displayName = String(body.displayName || body.display_name || "").trim();
      const exam = String(body.exam || "").toUpperCase();
      const classLevel = String(body.classLevel || body.class_level || "");
      const avatarUrl = body.avatarUrl !== undefined ? (body.avatarUrl ? String(body.avatarUrl).trim() : null) : (body.avatar_url !== undefined ? (body.avatar_url ? String(body.avatar_url).trim() : null) : (claims.picture || null));
      if (displayName.length < 2 || displayName.length > 80) return json({ error: "Name must be 2-80 characters." }, 400);
      if (!["JEE", "NEET"].includes(exam) || !["11", "12"].includes(classLevel)) return json({ error: "Choose JEE or NEET and class 11 or 12." }, 400);
      const existingProfile = await getProfile(db, claims.sub);
      const { data, error } = await db.from("student_profiles").upsert({
        firebase_uid: claims.sub, display_name: displayName, email: claims.email || null,
        exam: exam, class_level: classLevel, avatar_url: avatarUrl, updated_at: new Date().toISOString()
      }, { onConflict: "firebase_uid" }).select("*").single();
      if (error) throw error;
      if (!existingProfile) {
        // Running "all current and future students" audiences are applied here.
        // Failure never blocks onboarding; the admin console shows the rule and
        // can re-run enrollment at any time.
        await applyAutoEnrollmentRules(db, data).catch(() => undefined);
      }
      return json({ profile: data });
    }
    if (path === "/bootstrap" && method === "GET") {
      const profile = await getProfile(db, claims.sub);
      if (!profile) return json({ needsOnboarding: true, profile: null, content: [], announcements: [], enrollments: [] });
      let content = await readContent(db, { exam: profile.exam, classLevel: profile.class_level, activeOnly: true });
      content = await hideUnenrolledContent(db, claims.sub, content);
      const userEnrollments = await readActiveEnrollments(db, claims.sub);
      const { data: announcements, error } = await db.from("announcements").select("id,title,body,audience,active,scheduled_at,created_at")
        .eq("active", true).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      const filteredAnnouncements = (announcements || []).filter((a) => audienceMatches(a.audience, profile.exam, profile.class_level) && dateIsVisible(a.scheduled_at));
      return json({ needsOnboarding: false, profile: profile, content: redactStudentContent(content), announcements: filteredAnnouncements, enrollments: userEnrollments });
    }
    if (path === "/content" && method === "GET") {
      const profile = await getProfile(db, claims.sub);
      if (!profile) return json({ error: "Finish onboarding first." }, 409);
      const kind = url.searchParams.get("kind") || "";
      const requestedExam = url.searchParams.get("exam") || "";
      const requestedClass = url.searchParams.get("class") || "";
      if (requestedExam && requestedExam !== profile.exam) return json({ error: "Content is restricted to your selected exam." }, 403);
      if (requestedClass && String(requestedClass) !== String(profile.class_level)) return json({ error: "Content is restricted to your selected class." }, 403);
      const exam = profile.exam;
      const classLevel = profile.class_level;
      const parentId = url.searchParams.get("parentId") || "";
      if (kind && !ALLOWED_KINDS.has(kind)) return json({ error: "Invalid content kind." }, 400);
      if (parentId && ["lecture", "resource"].includes(kind) && isUuid(parentId)) {
        const { data: parent, error: parentError } = await db.from("course_catalog").select("id,kind").eq("id", parentId).maybeSingle();
        if (parentError) throw parentError;
        if (parent && ["batch", "series"].includes(parent.kind)) {
          const activeRows = await readActiveEnrollments(db, claims.sub);
          const enrolled = activeRows.some((row) => row.item_id === parentId && row.item_type === parent.kind);
          if (!enrolled) return json({ error: "Enroll in this batch or series to view its lessons." }, 403);
        }
      }
      let rows = await readContent(db, { kind: kind, exam: exam, classLevel: classLevel, parentId: parentId, activeOnly: true });
      rows = await hideUnenrolledContent(db, claims.sub, rows);
      return json({ items: redactStudentContent(rows) });
    }
    if (path === "/enrollments" && method === "POST") {
      const profile = await getProfile(db, claims.sub);
      if (!profile) return json({ error: "Finish onboarding first." }, 409);
      if (rateLimited(`enroll:${claims.sub}`, 15, 60_000)) return json(RATE_LIMITED_BODY, 429);
      const body = await bodyJson(req);
      const itemType = String(body.itemType || "");
      const itemId = String(body.itemId || "");
      if (!["batch", "series"].includes(itemType) || !isUuid(itemId)) return json({ error: "Invalid enrollment target." }, 400);
      const { data: item, error: itemError } = await db.from("course_catalog").select("*").eq("id", itemId).eq("active", true).maybeSingle();
      if (itemError) throw itemError;
      if (!item || item.kind !== itemType) return json({ error: "This item is not available." }, 404);
      if (!examMatches(item.exam, profile.exam) || !classMatches(item.classes, profile.class_level)) return json({ error: "This item is not available for your selected exam/class." }, 403);
      const suppliedCode = String(body.accessCode || "");
      const hasValidCode = Boolean(item.access_code) && suppliedCode === item.access_code;
      if (item.access_code && !hasValidCode) return json({ error: "The batch code is incorrect." }, 403);
      // Paid courses are granted by an administrator (or a valid access code).
      // A student can never self-grant paid access by editing a request.
      if (isPaidItem(item) && !hasValidCode) {
        return json({ error: "This is a paid course. Ask your mentor to enroll you." }, 402);
      }
      const expiresAt = accessExpiryForItem(item);
      let { data: existing, error: existingError } = await db.from("enrollments")
        .select("id,active,status,expires_at")
        .eq("firebase_uid", claims.sub).eq("item_type", itemType).eq("item_id", itemId)
        .maybeSingle();
      let legacySchema = false;
      if (existingError && isMissingColumn(existingError)) {
        legacySchema = true;
        const fallback = await db.from("enrollments").select("id,active")
          .eq("firebase_uid", claims.sub).eq("item_type", itemType).eq("item_id", itemId).maybeSingle();
        existing = fallback.data;
        existingError = fallback.error;
      }
      if (existingError) throw existingError;
      if (existing && enrollmentIsActive(existing)) {
        return json({ enrolled: true, enrollment: existing });
      }
      if (existing) {
        const update = legacySchema
          ? { active: true }
          : {
              active: true, status: "active", revoked_at: null, expires_at: expiresAt,
              source: hasValidCode ? "access_code" : "self_service", updated_at: new Date().toISOString(),
            };
        const { data, error } = await db.from("enrollments").update(update).eq("id", existing.id).select("*").single();
        if (error) throw error;
        return json({ enrolled: true, enrollment: data });
      }
      const insert = legacySchema
        ? { firebase_uid: claims.sub, item_type: itemType, item_id: itemId, active: true }
        : {
            firebase_uid: claims.sub, item_type: itemType, item_id: itemId, active: true,
            status: "active", source: hasValidCode ? "access_code" : "self_service", expires_at: expiresAt,
          };
      const { data, error } = await db.from("enrollments").insert(insert).select("*").single();
      if (error) throw error;
      return json({ enrolled: true, enrollment: data });
    }
    if (path === "/progress" && method === "POST") {
      const profile = await getProfile(db, claims.sub);
      if (!profile) return json({ error: "Finish onboarding first." }, 409);
      const body = await bodyJson(req);
      const lectureId = String(body.lectureId || body.lecture_id || "");
      const watchedSeconds = Math.max(0, Math.min(2147483647, Number(body.watchedSeconds || body.watched_seconds || 0) || 0));
      const completed = body.completed === true;
      if (!isUuid(lectureId)) return json({ error: "Invalid lecture id." }, 400);
      const access = await canAccessLecture(db, claims.sub, lectureId);
      if (!access.ok) return json({ error: access.error }, 403);
      const { data: existing, error: lookupError } = await db.from("lesson_progress").select("id,watched_seconds,completed")
        .eq("firebase_uid", claims.sub).eq("lecture_id", lectureId).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) {
        const { data, error } = await db.from("lesson_progress").update({
          watched_seconds: Math.max(existing.watched_seconds || 0, watchedSeconds),
          completed: Boolean(existing.completed || completed), updated_at: new Date().toISOString()
        }).eq("id", existing.id).select("*").single();
        if (error) throw error;
        return json({ progress: data });
      }
      const { data, error } = await db.from("lesson_progress").insert({
        firebase_uid: claims.sub, lecture_id: lectureId, watched_seconds: watchedSeconds, completed: completed
      }).select("*").single();
      if (error) throw error;
      return json({ progress: data });
    }
    if (path === "/tests" && method === "GET") {
      const profile = await getProfile(db, claims.sub);
      if (!profile) return json({ error: "Finish onboarding first." }, 409);
      const rows = await readContent(db, { kind: "test", exam: profile.exam, classLevel: profile.class_level, activeOnly: true });
      return json({ items: redactStudentContent(rows).map(testCard) });
    }
    const testMatch = path.match(/^\/tests\/([0-9a-f-]{36})(?:\/(submit|result))?$/i);
    if (testMatch && method === "GET" && testMatch[2] === "result") {
      const { data: attempts, error } = await db.from("exam_attempts").select("*").eq("firebase_uid", claims.sub).eq("test_id", testMatch[1]).order("submitted_at", { ascending: false }).limit(1);
      if (error) throw error;
      if (!attempts || !attempts.length) return json({ error: "No submitted result was found for this test." }, 404);
      const a = attempts[0];
      const answersData = a.answers && typeof a.answers === "object" ? a.answers : {};
      return json({ attempt: a, review: Array.isArray(answersData.review) ? answersData.review : [], result: { score: a.score, maxScore: a.max_score, correct: a.correct_count, incorrect: a.incorrect_count, unanswered: a.unanswered_count, percentage: Number(a.max_score) > 0 ? Math.round((Number(a.score) / Number(a.max_score)) * 10000) / 100 : 0 } });
    }
    if (testMatch && method === "GET" && !testMatch[2]) {
      const profile = await getProfile(db, claims.sub);
      if (!profile) return json({ error: "Finish onboarding first." }, 409);
      const item = await getTest(db, testMatch[1], profile);
      if (!item) return json({ error: "Test not found." }, 404);
      const meta = item.metadata || {};
      const startsAt = parseDate(meta.scheduledAt || meta.scheduled_at);
      const endsAt = parseDate(meta.endsAt || meta.ends_at);
      if (startsAt && startsAt.getTime() > Date.now() && meta.isLive !== true) return json({ error: "This test has not started yet.", startsAt: startsAt.toISOString() }, 409);
      if (endsAt && endsAt.getTime() < Date.now()) return json({ error: "This test has ended." }, 410);
      const questions = Array.isArray(meta.questions) ? meta.questions : [];
      return json({ test: testCard(item), questions: questions.map(sanitizeQuestion) });
    }
    if (testMatch && method === "POST" && testMatch[2] === "submit") {
      const profile = await getProfile(db, claims.sub);
      if (!profile) return json({ error: "Finish onboarding first." }, 409);
      const item = await getTest(db, testMatch[1], profile);
      if (!item) return json({ error: "Test not found." }, 404);
      const meta = item.metadata || {};
      const questions = Array.isArray(meta.questions) ? meta.questions : [];
      if (!questions.length) return json({ error: "This test has no questions yet." }, 409);
      const startsAt = parseDate(meta.scheduledAt || meta.scheduled_at);
      const endsAt = parseDate(meta.endsAt || meta.ends_at);
      if (startsAt && startsAt.getTime() > Date.now() && meta.isLive !== true) return json({ error: "This test has not started yet.", startsAt: startsAt.toISOString() }, 409);
      if (endsAt && endsAt.getTime() < Date.now()) return json({ error: "This test has ended." }, 410);
      if (meta.allowMultipleAttempts === false) {
        const { data: prior, error } = await db.from("exam_attempts").select("id").eq("firebase_uid", claims.sub).eq("test_id", item.id).limit(1);
        if (error) throw error;
        if ((prior || []).length) return json({ error: "You have already submitted this test." }, 409);
      }
      const body = await bodyJson(req);
      const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
      const marksDefault = Number(meta.marksPerQuestion ?? 4);
      const negativeDefault = Number(meta.negativeMarks ?? 1);
      let score = 0, maxScore = 0, correct = 0, incorrect = 0, unanswered = 0;
      const review = questions.map((q, index) => {
        const qid = String(q.id || index);
        const userAnswer = answers[qid] ?? answers[String(index)] ?? null;
        const correctAnswer = q.correctAnswer ?? q.correct_answer ?? q.answerKey ?? null;
        const marks = Number(q.marks ?? marksDefault);
        const negative = Number(q.negativeMarks ?? q.negative_marks ?? negativeDefault);
        maxScore += Math.max(0, marks);
        const given = normalizeAnswer(userAnswer);
        const expected = normalizeAnswer(correctAnswer);
        const isUnanswered = userAnswer === null || userAnswer === undefined || userAnswer === "";
        const isCorrect = !isUnanswered && expected !== "" && given === expected;
        if (isUnanswered) unanswered++;
        else if (isCorrect) { correct++; score += marks; }
        else { incorrect++; score -= negative; }
        return {
          questionId: qid, answer: userAnswer, correctAnswer: correctAnswer,
          isCorrect: isCorrect, explanation: q.explanation || "", marksAwarded: isUnanswered ? 0 : (isCorrect ? marks : -negative)
        };
      });
      const { data: attempt, error } = await db.from("exam_attempts").insert({
        firebase_uid: claims.sub, test_id: item.id, exam: profile.exam, class_level: profile.class_level,
        score: score, max_score: maxScore, correct_count: correct, incorrect_count: incorrect,
        unanswered_count: unanswered, answers: { submitted: answers, review: review }, submitted_at: new Date().toISOString()
      }).select("*").single();
      if (error) throw error;
      return json({ attempt: attempt, result: { score: score, maxScore: maxScore, correct, incorrect, unanswered, percentage: maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0 }, review: review });
    }
    if (path === "/analysis" && method === "GET") {
      const profile = await getProfile(db, claims.sub);
      if (!profile) return json({ error: "Finish onboarding first." }, 409);
      const { data: attempts, error: attemptsError } = await db.from("exam_attempts").select("id,test_id,score,max_score,correct_count,incorrect_count,unanswered_count,submitted_at").eq("firebase_uid", claims.sub).order("submitted_at", { ascending: false }).limit(500);
      if (attemptsError) throw attemptsError;
      const { data: progress, error: progressError } = await db.from("lesson_progress").select("lecture_id,watched_seconds,completed,updated_at").eq("firebase_uid", claims.sub).order("updated_at", { ascending: false }).limit(2000);
      if (progressError) throw progressError;
      const results = attempts || [];
      const totalScore = results.reduce((sum, a) => sum + Number(a.score || 0), 0);
      const totalMax = results.reduce((sum, a) => sum + Number(a.max_score || 0), 0);
      const avgPct = results.length ? results.reduce((sum, a) => sum + (Number(a.max_score) > 0 ? Math.max(0, Number(a.score) / Number(a.max_score) * 100) : 0), 0) / results.length : 0;
      const completedLessons = (progress || []).filter((p) => p.completed).length;
      const level = results.length >= 10 && avgPct >= 80 ? "Expert" : results.length >= 5 && avgPct >= 65 ? "Advanced" : results.length >= 2 && avgPct >= 45 ? "Intermediate" : "Beginner";
      return json({ profile: profile, level: level, testsTaken: results.length, averagePercentage: Math.round(avgPct * 100) / 100, totalScore: totalScore, totalMaxScore: totalMax, completedLessons: completedLessons, watchedSeconds: (progress || []).reduce((sum, p) => sum + Number(p.watched_seconds || 0), 0), attempts: results, lessonProgress: progress || [] });
    }
    if (path === "/leaderboard" && method === "GET") {
      const profile = await getProfile(db, claims.sub);
      if (!profile) return json({ error: "Finish onboarding first." }, 409);
      const testId = url.searchParams.get("testId") || "";
      let q = db.from("exam_attempts").select("id,firebase_uid,test_id,exam,class_level,score,max_score,submitted_at").eq("exam", profile.exam).eq("class_level", profile.class_level).order("score", { ascending: false }).order("submitted_at", { ascending: true }).limit(1000);
      if (testId) q = q.eq("test_id", testId);
      const { data: attempts, error } = await q;
      if (error) throw error;
      const latest = new Map();
      for (const a of attempts || []) {
        const k = a.firebase_uid + ":" + a.test_id;
        if (!latest.has(k)) latest.set(k, a);
      }
      const rows = Array.from(latest.values()).sort((a, b) => Number(b.score) - Number(a.score) || new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
      const userIds = Array.from(new Set(rows.map((a) => a.firebase_uid)));
      const names = {};
      for (let i = 0; i < userIds.length; i += 100) {
        const { data, error: profileError } = await db.from("student_profiles").select("firebase_uid,display_name,avatar_url").in("firebase_uid", userIds.slice(i, i + 100));
        if (profileError) throw profileError;
        for (const p of data || []) names[p.firebase_uid] = p;
      }
      return json({ testId: testId || null, items: rows.map((a, i) => ({ rank: i + 1, testId: a.test_id, firebaseUid: a.firebase_uid, name: names[a.firebase_uid]?.display_name || "Student", avatarUrl: names[a.firebase_uid]?.avatar_url || null, score: a.score, maxScore: a.max_score, submittedAt: a.submitted_at })) });
    }
    // -----------------------------------------------------------------
    // Site settings (visual CMS) — admin only, except /public/site above
    // -----------------------------------------------------------------
    if (path === "/admin/site-settings" && method === "GET") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const { data, error } = await db.from("site_settings").select("key,draft,published,published_at,updated_at,updated_by").order("key", { ascending: true });
      if (error) throw error;
      return json({ items: data || [] });
    }
    const siteSettingMatch = path.match(/^\/admin\/site-settings\/([a-z-]+)(?:\/(publish))?$/);
    if (siteSettingMatch) {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const key = siteSettingMatch[1];
      const action = siteSettingMatch[2] || "";
      if (!SITE_SETTING_KEYS.includes(key)) return json({ error: "Unknown site settings key." }, 404);
      if (method === "GET" && !action) {
        const { data, error } = await db.from("site_settings").select("key,draft,published,published_at,updated_at,updated_by").eq("key", key).maybeSingle();
        if (error) throw error;
        return json({ item: data || { key, draft: {}, published: {}, published_at: null, updated_at: null } });
      }
      if (method === "PATCH" && !action) {
        const body = await bodyJson(req);
        const draft = body.draft;
        const validationError = validateSettingDraft(key, draft);
        if (validationError) return json({ error: validationError }, 400);
        const now = new Date().toISOString();
        const { data, error } = await db.from("site_settings").upsert({
          key: key,
          draft: draft,
          updated_at: now,
          updated_by: claims.email || claims.sub,
        }, { onConflict: "key" }).select("key,draft,published,published_at,updated_at,updated_by").single();
        if (error) throw error;
        await logActivity(db, claims, "settings.draft.save", "site_settings", key, `Saved draft for ${key}`);
        return json({ item: data });
      }
      if (method === "POST" && action === "publish") {
        const { data: current, error: currentError } = await db.from("site_settings").select("*").eq("key", key).maybeSingle();
        if (currentError) throw currentError;
        if (!current) return json({ error: "Save a draft before publishing." }, 409);
        if (!current.draft || typeof current.draft !== "object") return json({ error: "The draft is empty or invalid." }, 400);
        const now = new Date().toISOString();
        const { data, error } = await db.from("site_settings").update({
          published: current.draft,
          published_at: now,
          updated_at: now,
          updated_by: claims.email || claims.sub,
        }).eq("key", key).select("key,draft,published,published_at,updated_at,updated_by").single();
        if (error) throw error;
        await logActivity(db, claims, "settings.publish", "site_settings", key, `Published ${key}`);
        return json({ item: data });
      }
      if (method === "DELETE" && !action) {
        const { error } = await db.from("site_settings").delete().eq("key", key);
        if (error) throw error;
        await logActivity(db, claims, "settings.reset", "site_settings", key, `Reset ${key} to built-in defaults`);
        return json({ reset: true });
      }
    }

    if (path === "/admin/activity" && method === "GET") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 100) || 100));
      const { data, error } = await db.from("admin_activity").select("id,actor_email,action,target_type,target_id,summary,created_at").order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return json({ items: data || [] });
    }

    if (path === "/admin/analytics" && method === "GET") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      return json(await buildAdminAnalytics(db));
    }

    if (path === "/admin/enrollments" && method === "GET") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const studentFilter = String(url.searchParams.get("student") || "").trim().toLowerCase();
      const itemFilter = String(url.searchParams.get("item") || "").trim().toLowerCase();
      const { data: rows, error } = await db.from("enrollments").select("*").order("created_at", { ascending: false }).limit(5000);
      if (error) throw error;
      const items = await hydrateEnrollments(db, rows || []);
      const filtered = items.filter((row) => {
        if (studentFilter) {
          const haystack = `${row.student_name || ""} ${row.student_email || ""} ${row.firebase_uid}`.toLowerCase();
          if (!haystack.includes(studentFilter)) return false;
        }
        if (itemFilter) {
          const haystack = `${row.item_title || ""} ${row.item_id}`.toLowerCase();
          if (!haystack.includes(itemFilter)) return false;
        }
        return true;
      });
      return json({ items: filtered });
    }
    if (path === "/admin/enrollments" && method === "POST") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const body = await bodyJson(req);
      const studentUid = String(body.studentUid || "").trim();
      const itemType = String(body.itemType || "");
      const itemId = String(body.itemId || "");
      if (!studentUid) return json({ error: "Choose a student." }, 400);
      if (!["batch", "series"].includes(itemType) || !isUuid(itemId)) return json({ error: "Choose a valid batch or series." }, 400);
      const { data: profile, error: profileError } = await db.from("student_profiles").select("firebase_uid").eq("firebase_uid", studentUid).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) return json({ error: "Student not found." }, 404);
      const { data: item, error: itemError } = await db.from("course_catalog").select("id,kind,title").eq("id", itemId).maybeSingle();
      if (itemError) throw itemError;
      if (!item || item.kind !== itemType) return json({ error: "That batch or series does not exist." }, 404);
      const { data: existing, error: existingError } = await db.from("enrollments").select("id,active").eq("firebase_uid", studentUid).eq("item_type", itemType).eq("item_id", itemId).maybeSingle();
      if (existingError) throw existingError;
      let row;
      if (existing) {
        const { data, error } = await db.from("enrollments").update({ active: true }).eq("id", existing.id).select("*").single();
        if (error) throw error;
        row = data;
      } else {
        const { data, error } = await db.from("enrollments").insert({ firebase_uid: studentUid, item_type: itemType, item_id: itemId, active: true }).select("*").single();
        if (error) throw error;
        row = data;
      }
      await logActivity(db, claims, "enrollment.create", "enrollments", row.id, `Enrolled ${studentUid} in ${item.title}`);
      const hydrated = await hydrateEnrollments(db, [row]);
      return json({ item: hydrated[0] }, existing ? 200 : 201);
    }
    const adminEnrollmentMatch = path.match(/^\/admin\/enrollments\/([0-9a-f-]{36})$/i);
    if (adminEnrollmentMatch && method === "DELETE") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const { data: row, error: lookupError } = await db.from("enrollments").select("id,firebase_uid,item_type,item_id").eq("id", adminEnrollmentMatch[1]).maybeSingle();
      if (lookupError) throw lookupError;
      if (!row) return json({ error: "Enrollment not found." }, 404);
      const { error } = await db.from("enrollments").delete().eq("id", row.id);
      if (error) throw error;
      await logActivity(db, claims, "enrollment.remove", "enrollments", row.id, `Removed enrollment ${row.firebase_uid} → ${row.item_type}:${row.item_id}`);
      return json({ removed: true });
    }

    // -----------------------------------------------------------------
    // Student personal library
    // -----------------------------------------------------------------
    if (path === "/library" && method === "GET") {
      const profile = await getProfile(db, claims.sub);
      if (!profile) return json({ error: "Finish onboarding first." }, 409);
      const { data, error } = await db.from("student_library").select("*").eq("firebase_uid", claims.sub).order("updated_at", { ascending: false }).limit(500);
      if (error) throw error;
      return json({ items: data || [] });
    }
    if (path === "/library" && method === "POST") {
      const profile = await getProfile(db, claims.sub);
      if (!profile) return json({ error: "Finish onboarding first." }, 409);
      const body = await bodyJson(req);
      const itemType = String(body.itemType || "");
      const itemId = String(body.itemId || "").trim();
      const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload : {};
      if (!LIBRARY_ITEM_TYPES.has(itemType)) return json({ error: "Invalid library item type." }, 400);
      if (!itemId || itemId.length > 200) return json({ error: "Invalid library item id." }, 400);
      if (JSON.stringify(payload).length > 20000) return json({ error: "This library item is too large." }, 400);
      const now = new Date().toISOString();
      const { data, error } = await db.from("student_library").upsert({
        firebase_uid: claims.sub,
        item_type: itemType,
        item_id: itemId,
        payload: payload,
        updated_at: now,
      }, { onConflict: "firebase_uid,item_type,item_id" }).select("*").single();
      if (error) throw error;
      return json({ item: data });
    }
    const libraryDeleteMatch = path.match(/^\/library\/(bookmark|note|recent|challenge|revision)\/([^/]+)$/);
    if (libraryDeleteMatch && method === "DELETE") {
      const profile = await getProfile(db, claims.sub);
      if (!profile) return json({ error: "Finish onboarding first." }, 409);
      const itemType = libraryDeleteMatch[1];
      const itemId = decodeURIComponent(libraryDeleteMatch[2]);
      if (!itemId || itemId.length > 200) return json({ error: "Invalid library item id." }, 400);
      const { error } = await db.from("student_library").delete().eq("firebase_uid", claims.sub).eq("item_type", itemType).eq("item_id", itemId);
      if (error) throw error;
      return json({ removed: true });
    }

    if (path === "/admin/overview" && method === "GET") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const counts = {};
      const tables = ["student_profiles", "course_catalog", "exam_attempts", "enrollments", "announcements"];
      for (const table of tables) {
        const key = table === "student_profiles" ? "firebase_uid" : "id";
        const { count, error } = await db.from(table).select(key, { count: "exact", head: true });
        if (error) throw error;
        counts[table] = count || 0;
      }
      const { data: latest, error: latestError } = await db.from("course_catalog").select("id,kind,title,exam,classes,active,updated_at").order("updated_at", { ascending: false }).limit(10);
      if (latestError) throw latestError;
      return json({ counts, latestContent: latest || [] });
    }
    if (path === "/admin/students" && method === "GET") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const search = String(url.searchParams.get("query") || "").trim();
      const exam = String(url.searchParams.get("exam") || "").toUpperCase();
      const classLevel = String(url.searchParams.get("class") || "");
      const page = Math.max(1, Math.floor(Number(url.searchParams.get("page") || 1) || 1));
      const pageSize = Math.min(100, Math.max(1, Math.floor(Number(url.searchParams.get("pageSize") || 25) || 25)));
      let query = db.from("student_profiles")
        .select("firebase_uid,display_name,email,exam,class_level,avatar_url,created_at,updated_at", { count: "exact" });
      if (exam === "JEE" || exam === "NEET") query = query.eq("exam", exam);
      if (classLevel === "11" || classLevel === "12") query = query.eq("class_level", classLevel);
      if (search) {
        const safe = search.replace(/[,()%_]/g, "").slice(0, 80);
        if (safe) query = query.or(`display_name.ilike.%${safe}%,email.ilike.%${safe}%,firebase_uid.eq.${safe}`);
      }
      const from = (page - 1) * pageSize;
      const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
      if (error) throw error;
      return json({ items: data || [], total: count || 0, page, pageSize });
    }
    if (path === "/admin/content" && method === "GET") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const kind = url.searchParams.get("kind") || "";
      const exam = url.searchParams.get("exam") || "";
      const classLevel = url.searchParams.get("class") || "";
      const rows = await readContent(db, { kind, exam, classLevel, activeOnly: false });
      return json({ items: rows });
    }
    if (path === "/admin/content" && method === "POST") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const body = await bodyJson(req);
      const row = normalizeContentBody(body, null);
      const { data, error } = await db.from("course_catalog").insert(row).select("*").single();
      if (error) throw error;
      await logActivity(db, claims, "content.create", "course_catalog", data.id, `Created ${data.kind}: ${data.title}`);
      return json({ item: data }, 201);
    }
    const adminContentMatch = path.match(/^\/admin\/content\/([0-9a-f-]{36})$/i);
    if (adminContentMatch && method === "PATCH") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const body = await bodyJson(req);
      const row = normalizeContentBody(body, adminContentMatch[1]);
      const { data, error } = await db.from("course_catalog").update(row).eq("id", adminContentMatch[1]).select("*").single();
      if (error) throw error;
      await logActivity(db, claims, "content.update", "course_catalog", data.id, `Updated ${data.kind}: ${data.title}`);
      return json({ item: data });
    }
    if (adminContentMatch && method === "DELETE") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const { data, error } = await db.from("course_catalog").update({ active: false, updated_at: new Date().toISOString() }).eq("id", adminContentMatch[1]).select("id,kind,title,active").single();
      if (error) throw error;
      await logActivity(db, claims, "content.disable", "course_catalog", data.id, `Disabled ${data.kind}: ${data.title}`);
      return json({ item: data, disabled: true });
    }
    if (path === "/admin/announcements" && method === "GET") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const { data, error } = await db.from("announcements").select("*").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return json({ items: data || [] });
    }
    if (path === "/admin/announcements" && method === "POST") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const body = await bodyJson(req);
      const row = normalizeAnnouncement(body);
      const { data, error } = await db.from("announcements").insert(row).select("*").single();
      if (error) throw error;
      await logActivity(db, claims, "announcement.create", "announcements", data.id, `Created announcement: ${data.title}`);
      return json({ item: data }, 201);
    }
    const adminAnnouncementMatch = path.match(/^\/admin\/announcements\/([0-9a-f-]{36})$/i);
    if (adminAnnouncementMatch && method === "PATCH") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const body = await bodyJson(req);
      const { data: current, error: currentError } = await db.from("announcements").select("*").eq("id", adminAnnouncementMatch[1]).single();
      if (currentError) throw currentError;
      const row = normalizeAnnouncement(Object.assign({}, current, body));
      const { data, error } = await db.from("announcements").update(row).eq("id", adminAnnouncementMatch[1]).select("*").single();
      if (error) throw error;
      await logActivity(db, claims, "announcement.update", "announcements", data.id, `Updated announcement: ${data.title}`);
      return json({ item: data });
    }
    return json({ error: "Not found", path: path }, 404);
  } catch (error) {
    const message = String(error && error.message || error || "Unexpected server error");
    if (message.indexOf("Unauthorized") >= 0) return json({ error: "Please sign in again." }, 401);
    if (message.indexOf("Server database credentials") >= 0) return json({ error: message }, 503);
    if (message.indexOf("Invalid JSON") >= 0) return json({ error: "The request body is not valid JSON." }, 400);
    if (message.indexOf("Request body is too large") >= 0) return json({ error: message }, 413);
    const debug = Deno.env.get("DEBUG_API_ERRORS") === "1";
    return json(debug ? { error: "Request failed.", detail: message } : { error: "Request failed. Please try again." }, 500);
  }
});

function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: Object.assign({}, CORS_HEADERS, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }) });
}
function normalizePath(path) {
  const p = path.replace(/\/+$/, "");
  const marker = "/exam-cracker-api";
  const index = p.indexOf(marker);
  return (index >= 0 ? p.slice(index + marker.length) : p) || "/";
}
async function bodyJson(req) {
  const declared = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new Error("Request body is too large.");
  let text;
  try { text = await req.text(); } catch (_) { throw new Error("Invalid JSON request body."); }
  if (text.length > MAX_BODY_BYTES) throw new Error("Request body is too large.");
  if (!text) return {};
  try { return JSON.parse(text); } catch (_) { throw new Error("Invalid JSON request body."); }
}
function b64urlDecode(s) {
  const v = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = v + "=".repeat((4 - v.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function base64urlToBytes(s) {
  const v = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = v + "=".repeat((4 - v.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
async function getFirebaseJwks() {
  if (cachedJwks && cachedJwksExpiresAt > Date.now()) return cachedJwks;
  const response = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  if (!response.ok) throw new Error("Unable to load authentication keys.");
  const data = await response.json();
  cachedJwks = data.keys || [];
  cachedJwksExpiresAt = Date.now() + 60 * 60 * 1000;
  return cachedJwks;
}
async function requireFirebaseUser(req) {
  const header = req.headers.get("Authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token || token.split(".").length !== 3) throw new Error("Unauthorized");
  const parts = token.split(".");
  let head, claims;
  try { head = JSON.parse(b64urlDecode(parts[0])); claims = JSON.parse(b64urlDecode(parts[1])); }
  catch (_) { throw new Error("Unauthorized"); }
  if (head.alg !== "RS256" || !head.kid || claims.aud !== FIREBASE_PROJECT_ID ||
      claims.iss !== "https://securetoken.google.com/" + FIREBASE_PROJECT_ID ||
      !claims.sub || typeof claims.sub !== "string" ||
      Number(claims.exp) <= Math.floor(Date.now() / 1000) ||
      Number(claims.iat) > Math.floor(Date.now() / 1000) + 300) throw new Error("Unauthorized");
  const jwks = await getFirebaseJwks();
  const jwk = jwks.find((k) => k.kid === head.kid);
  if (!jwk) throw new Error("Unauthorized");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const verified = await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, base64urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!verified) throw new Error("Unauthorized");
  if (claims.auth_time && Number(claims.auth_time) > Math.floor(Date.now() / 1000) + 300) throw new Error("Unauthorized");
  return claims;
}
function getDefaultSecretKey() {
  try {
    const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!raw) return "";
    const obj = JSON.parse(raw);
    return obj.default || Object.values(obj)[0] || "";
  } catch (_) { return ""; }
}
async function getProfile(db, uid) {
  const { data, error } = await db.from("student_profiles").select("*").eq("firebase_uid", uid).maybeSingle();
  if (error) throw error;
  return data || null;
}
function examMatches(contentExam, exam) { return contentExam === "Both" || contentExam === exam; }
function classMatches(classes, classLevel) { return !Array.isArray(classes) || classes.includes(String(classLevel)); }
function audienceMatches(audience, exam, classLevel) {
  if (!audience || audience === "All" || audience === "all") return true;
  const a = String(audience).toUpperCase();
  return a === String(exam).toUpperCase() || a === (String(exam) + "_" + String(classLevel)).toUpperCase() || a === (String(exam) + " " + String(classLevel)).toUpperCase();
}
function dateIsVisible(value) { return !value || new Date(value).getTime() <= Date.now(); }
function parseDate(value) { if (!value) return null; const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; }
async function readContent(db, options) {
  let q = db.from("course_catalog").select("*").order("created_at", { ascending: false }).limit(3000);
  if (options.kind) q = q.eq("kind", options.kind);
  if (options.activeOnly) q = q.eq("active", true);
  if (options.exam && ["JEE", "NEET"].includes(options.exam)) q = q.in("exam", [options.exam, "Both"]);
  if (options.classLevel && ["11", "12"].includes(String(options.classLevel))) q = q.contains("classes", [String(options.classLevel)]);
  const { data, error } = await q;
  if (error) throw error;
  let rows = data || [];
  if (options.parentId) rows = rows.filter((r) => String((r.metadata || {}).parentId || (r.metadata || {}).parent_id || (r.metadata || {}).batchId || "") === String(options.parentId));
  return rows;
}
function redactStudentContent(rows) {
  return (rows || []).map((r) => {
    const copy = Object.assign({}, r);
    const hasAccessCode = Boolean(copy.access_code || (copy.metadata && (copy.metadata.requiresAccessCode || copy.metadata.hasAccessCode)));
    delete copy.access_code;
    copy.hasAccessCode = hasAccessCode;
    if (copy.kind === "test" && copy.metadata && Array.isArray(copy.metadata.questions)) {
      copy.metadata = Object.assign({}, copy.metadata, { questions: copy.metadata.questions.map(sanitizeQuestion) });
    }
    return copy;
  });
}
async function hideUnenrolledContent(db, uid, rows) {
  const candidates = (rows || []).filter((r) => ["lecture", "resource"].includes(r.kind));
  if (!candidates.length) return rows || [];
  const activeRows = await readActiveEnrollments(db, uid);
  const enrolled = new Set(activeRows.map((x) => x.item_type + ":" + x.item_id));
  return (rows || []).filter((r) => {
    if (!["lecture", "resource"].includes(r.kind)) return true;
    const m = r.metadata || {};
    const parent = String(m.parentId || m.parent_id || m.batchId || m.batch_id || "");
    if (!parent) return true;
    return enrolled.has("batch:" + parent) || enrolled.has("series:" + parent);
  });
}
function testCard(item) {
  const m = item.metadata || {};
  return { id: item.id, kind: item.kind, title: item.title, description: item.description, exam: item.exam, classes: item.classes,
    active: item.active, thumbnailUrl: m.thumbnailUrl || m.thumbnail_url || null, scheduledAt: m.scheduledAt || m.scheduled_at || null,
    endsAt: m.endsAt || m.ends_at || null, durationMinutes: Number(m.durationMinutes || m.duration_minutes || 0),
    totalQuestions: Array.isArray(m.questions) ? m.questions.length : Number(m.totalQuestions || 0),
    totalMarks: m.totalMarks || null, isLive: m.isLive === true, subject: m.subject || null };
}
function sanitizeQuestion(q, index) {
  const copy = Object.assign({}, q);
  delete copy.correctAnswer; delete copy.correct_answer; delete copy.answerKey; delete copy.answer_key; delete copy.explanation;
  copy.id = String(q.id || index);
  return copy;
}
async function getTest(db, id, profile) {
  if (!isUuid(id)) return null;
  const { data, error } = await db.from("course_catalog").select("*").eq("id", id).eq("kind", "test").eq("active", true).maybeSingle();
  if (error) throw error;
  if (!data || !examMatches(data.exam, profile.exam) || !classMatches(data.classes, profile.class_level)) return null;
  return data;
}
function normalizeAnswer(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((v) => String(v).trim().toLowerCase()).sort().join("|");
  return String(value).trim().toLowerCase();
}
function normalizeContentBody(body, id) {
  const kind = String(body.kind || "lecture");
  const title = String(body.title || "").trim();
  const exam = String(body.exam || "Both");
  const classes = Array.isArray(body.classes) ? body.classes.map(String) : ["11", "12"];
  if (!ALLOWED_KINDS.has(kind)) throw new Error("Invalid content kind.");
  if (!title || title.length > 180) throw new Error("Content title is required and must be under 180 characters.");
  if (!ALLOWED_EXAMS.has(exam)) throw new Error("Exam must be JEE, NEET, or Both.");
  if (!classes.length || classes.some((x) => !["11", "12"].includes(x))) throw new Error("Classes must contain 11 and/or 12.");
  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  const row = {
    kind: kind, title: title, description: String(body.description || "").slice(0, 10000),
    exam: exam, classes: classes, active: body.active !== false,
    access_code: body.accessCode === undefined ? (body.access_code === undefined ? null : (body.access_code || null)) : (body.accessCode || null),
    metadata: metadata, updated_at: new Date().toISOString()
  };
  if (!id) row.created_at = new Date().toISOString();
  return row;
}
function normalizeAnnouncement(body) {
  const title = String(body.title || "").trim();
  const text = String(body.body || "").trim();
  if (!title || title.length > 180 || !text || text.length > 10000) throw new Error("Announcement title and body are required.");
  const scheduledAt = body.scheduled_at || body.scheduledAt || null;
  return {
    title: title, body: text, audience: String(body.audience || "All"), active: body.active !== false,
    scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null
  };
}

async function publicSitePayload(db) {
  const { data, error } = await db.from("site_settings").select("key,published,published_at").in("key", SITE_SETTING_KEYS);
  if (error) {
    const message = String(error.message || "");
    if (error.code === "42P01" || message.indexOf("does not exist") >= 0) {
      return json({ config: {}, publishedAt: {}, degraded: true });
    }
    throw error;
  }
  const config = {};
  const publishedAt = {};
  for (const row of data || []) {
    if (row.published && typeof row.published === "object" && Object.keys(row.published).length > 0) {
      config[row.key] = row.published;
      publishedAt[row.key] = row.published_at;
    }
  }
  return json({ config: config, publishedAt: publishedAt, degraded: false });
}

function validateSettingDraft(key, draft) {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return "Settings must be a JSON object.";
  let serialized = "";
  try { serialized = JSON.stringify(draft); } catch (_) { return "Settings must be valid JSON."; }
  if (serialized.length > MAX_SETTING_BYTES) return "This settings document is too large.";
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const isArray = (value) => Array.isArray(value);
  if (key === "theme") {
    if (typeof draft.brandName !== "string" || !draft.brandName.trim() || draft.brandName.length > 80) return "Brand name is required (80 characters max).";
    for (const field of ["primaryColor", "secondaryColor", "accentColor", "backgroundColor", "surfaceColor", "textColor"]) {
      if (typeof draft[field] !== "string" || !hex.test(draft[field])) return "Theme colours must be hex values.";
    }
    if (Number(draft.radius) < 0 || Number(draft.radius) > 32) return "Radius must be between 0 and 32.";
  } else if (key === "login") {
    if (typeof draft.title !== "string" || !draft.title.trim() || draft.title.length > 120) return "Login title is required (120 characters max).";
    if (typeof draft.emailLabel !== "string" || !draft.emailLabel.trim()) return "Email label is required.";
    if (typeof draft.passwordLabel !== "string" || !draft.passwordLabel.trim()) return "Password label is required.";
    if (isArray(draft.highlights) && draft.highlights.length > 8) return "Keep highlights to 8 items or fewer.";
  } else if (key === "homepage") {
    if (!isArray(draft.sections)) return "Homepage sections must be an array.";
    if (draft.sections.length > 40) return "A maximum of 40 homepage sections is supported.";
    if (draft.sections.some((section) => !section || typeof section !== "object" || !section.id || !section.type)) return "Every homepage section needs an id and type.";
  } else if (key === "navigation") {
    if (!isArray(draft.headerLinks) || !isArray(draft.bottomLinks)) return "Navigation links must be arrays.";
    if (draft.headerLinks.length > 10 || draft.bottomLinks.length > 10) return "Navigation supports up to 10 links per surface.";
  } else if (key === "footer") {
    if (isArray(draft.columns) && draft.columns.length > 4) return "The footer supports up to 4 columns.";
  } else if (key === "banners") {
    if (!isArray(draft.items)) return "Banners must include an items array.";
    if (draft.items.length > 40) return "A maximum of 40 banners is supported.";
    if (draft.items.some((banner) => !banner || typeof banner.title !== "string" || !banner.title.trim())) return "Every banner needs a title.";
    if (Number(draft.rotationSeconds) < 3 || Number(draft.rotationSeconds) > 20) return "Carousel rotation must be between 3 and 20 seconds.";
  } else if (key === "popups") {
    if (!isArray(draft.items) || draft.items.length > 30) return "Popups must be an items array (30 max).";
  } else if (key === "testimonials") {
    if (!isArray(draft.items) || draft.items.length > 40) return "Testimonials must be an items array (40 max).";
  } else if (key === "challenges") {
    if (!isArray(draft.items) || draft.items.length > 30) return "Challenges must be an items array (30 max).";
  } else if (key === "features") {
    if (Object.keys(draft).length > 40) return "Too many feature flags.";
  } else if (key === "seo") {
    if (typeof draft.title !== "string" || !draft.title.trim() || draft.title.length > 120) return "SEO title is required (120 characters max).";
    if (isArray(draft.keywords) && draft.keywords.length > 20) return "Keep keywords to 20 items or fewer.";
  } else if (key === "media") {
    if (!isArray(draft.items) || draft.items.length > 300) return "Media library must be an items array (300 max).";
  }
  return "";
}

async function logActivity(db, claims, action, targetType, targetId, summary, metadata) {
  try {
    const { error } = await db.from("admin_activity").insert({
      actor_uid: claims.sub,
      actor_email: claims.email || "",
      action: action,
      target_type: targetType,
      target_id: String(targetId || ""),
      summary: String(summary || "").slice(0, 500),
      metadata: metadata && typeof metadata === "object" ? metadata : {},
    });
    if (error) return;
  } catch (_) {
    // Auditing must never block the primary write.
  }
}

function isMissingColumn(error) {
  const code = String(error && error.code || "");
  const message = String(error && error.message || "");
  return code === "42703" || (message.includes("column") && message.includes("does not exist"));
}

function accessExpiryForItem(item) {
  const meta = (item && item.metadata) || {};
  const days = Number(meta.accessDays ?? meta.access_days ?? meta.durationDays ?? meta.duration_days ?? 0);
  if (Number.isFinite(days) && days > 0 && days <= 3650) {
    return new Date(Date.now() + days * 86400000).toISOString();
  }
  return null;
}

async function readActiveEnrollments(db, uid) {
  const full = await db.from("enrollments")
    .select("id,item_type,item_id,active,status,expires_at,created_at")
    .eq("firebase_uid", uid).eq("active", true);
  if (!full.error) return (full.data || []).filter((row) => enrollmentIsActive(row));
  // Graceful fallback while a deployment is waiting for the enrollment
  // migration to run. Access still requires an active row.
  const legacy = await db.from("enrollments")
    .select("id,item_type,item_id,active,created_at")
    .eq("firebase_uid", uid).eq("active", true);
  if (legacy.error) throw legacy.error;
  return legacy.data || [];
}

async function canAccessLecture(db, uid, lectureId, profile) {
  const { data: lecture, error } = await db.from("course_catalog")
    .select("id,kind,active,exam,classes,metadata").eq("id", lectureId).maybeSingle();
  if (error) throw error;
  if (!lecture || lecture.active === false) return { ok: false, error: "This lesson is not available." };
  if (!["lecture", "resource"].includes(lecture.kind)) return { ok: false, error: "This content is not a lesson." };
  if (!examMatches(lecture.exam, profile.exam) || !classMatches(lecture.classes, profile.class_level)) {
    return { ok: false, error: "This lesson is not available for your exam/class." };
  }
  const meta = lecture.metadata || {};
  if (meta.isPreview === true) return { ok: true };
  const parent = String(meta.parentId || meta.parent_id || meta.batchId || meta.batch_id || "");
  if (!parent) return { ok: true };
  const rows = await readActiveEnrollments(db, uid);
  const enrolled = rows.some((row) => row.item_id === parent);
  return enrolled
    ? { ok: true }
    : { ok: false, error: "Enroll in the parent batch or series to record progress." };
}

async function applyAutoEnrollmentRules(db, profile) {
  let rules = [];
  try {
    const { data, error } = await db.from("enrollment_rules")
      .select("id,item_type,item_id,filter_exam,filter_class,respect_eligibility,expires_at,active,include_future")
      .eq("active", true).eq("include_future", true).limit(200);
    if (error) return;
    rules = data || [];
  } catch (_) {
    return;
  }
  if (!rules.length) return;
  const itemIds = Array.from(new Set(rules.map((rule) => rule.item_id)));
  const { data: items, error: itemsError } = await db.from("course_catalog")
    .select("id,kind,title,exam,classes,active,metadata").in("id", itemIds);
  if (itemsError) return;
  const itemsById = {};
  for (const item of items || []) itemsById[item.id] = item;

  for (const rule of rules) {
    try {
      const item = itemsById[rule.item_id];
      if (!item || item.active === false) continue;
      if (rule.filter_exam && profile.exam !== rule.filter_exam) continue;
      if (rule.filter_class && String(profile.class_level) !== String(rule.filter_class)) continue;
      if (rule.respect_eligibility !== false && !isEligibleForItem(item, profile)) continue;

      const { data: existing, error: lookupError } = await db.from("enrollments")
        .select("id,active,status,expires_at")
        .eq("firebase_uid", profile.firebase_uid)
        .eq("item_type", item.kind).eq("item_id", item.id).maybeSingle();
      if (lookupError) continue;
      if (existing && enrollmentIsActive(existing)) continue;

      const now = new Date().toISOString();
      const payload = {
        firebase_uid: profile.firebase_uid,
        item_type: item.kind,
        item_id: item.id,
        active: true,
        status: "active",
        source: "auto_rule",
        granted_by: "auto-enrollment-rule",
        expires_at: rule.expires_at || null,
        revoked_at: null,
        updated_at: now,
      };
      let enrollmentId = existing?.id || null;
      let writeError = null;
      if (existing) {
        const result = await db.from("enrollments").update(payload).eq("id", existing.id).select("id").single();
        writeError = result.error;
        enrollmentId = result.data?.id || enrollmentId;
      } else {
        const result = await db.from("enrollments").insert(payload).select("id").single();
        writeError = result.error;
        enrollmentId = result.data?.id || null;
      }
      if (writeError) continue;
      await db.from("enrollment_events").insert({
        enrollment_id: enrollmentId,
        firebase_uid: profile.firebase_uid,
        item_type: item.kind,
        item_id: item.id,
        action: "auto_enrolled",
        source: "auto_rule",
        actor_uid: "system",
        actor_email: "",
        detail: { title: item.title, ruleId: rule.id },
      }).then(() => undefined, () => undefined);
      await db.from("enrollment_rules").update({
        last_applied_at: now,
        last_applied_count: Number(rule.last_applied_count || 0) + 1,
      }).eq("id", rule.id).then(() => undefined, () => undefined);
    } catch (_) {
      // A single broken rule must not prevent the student from onboarding.
    }
  }
}

async function hydrateEnrollments(db, rows) {
  const list = rows || [];
  if (!list.length) return [];
  const uids = Array.from(new Set(list.map((row) => row.firebase_uid)));
  const itemIds = Array.from(new Set(list.map((row) => row.item_id)));
  const profiles = {};
  const titles = {};
  if (uids.length) {
    const { data, error } = await db.from("student_profiles").select("firebase_uid,display_name,email,exam,class_level").in("firebase_uid", uids);
    if (error) throw error;
    for (const profile of data || []) profiles[profile.firebase_uid] = profile;
  }
  if (itemIds.length) {
    const { data, error } = await db.from("course_catalog").select("id,title").in("id", itemIds);
    if (error) throw error;
    for (const item of data || []) titles[item.id] = item.title;
  }
  return list.map((row) => ({
    id: row.id,
    firebase_uid: row.firebase_uid,
    student_name: profiles[row.firebase_uid]?.display_name || null,
    student_email: profiles[row.firebase_uid]?.email || null,
    exam: profiles[row.firebase_uid]?.exam || null,
    class_level: profiles[row.firebase_uid]?.class_level || null,
    item_type: row.item_type,
    item_id: row.item_id,
    item_title: titles[row.item_id] || null,
    active: Boolean(row.active),
    created_at: row.created_at,
  }));
}

async function buildAdminAnalytics(db) {
  const [profilesRes, contentRes, attemptsRes, enrollmentsRes] = await Promise.all([
    db.from("student_profiles").select("firebase_uid,display_name,email,exam,class_level,avatar_url,created_at").order("created_at", { ascending: false }).limit(5000),
    db.from("course_catalog").select("id,kind,title,active,exam,classes,metadata,updated_at").limit(5000),
    db.from("exam_attempts").select("firebase_uid,test_id,score,max_score,correct_count,incorrect_count,unanswered_count,submitted_at").order("submitted_at", { ascending: false }).limit(5000),
    db.from("enrollments").select("firebase_uid,item_type,item_id,active").limit(5000),
  ]);
  for (const res of [profilesRes, contentRes, attemptsRes, enrollmentsRes]) {
    if (res.error) throw res.error;
  }
  const profiles = profilesRes.data || [];
  const content = contentRes.data || [];
  const attempts = attemptsRes.data || [];
  const enrollments = enrollmentsRes.data || [];
  const percentage = (score, maxScore) => (Number(maxScore) > 0 ? (Number(score) / Number(maxScore)) * 100 : 0);

  const byExam = { JEE: 0, NEET: 0 };
  const byClass = { "11": 0, "12": 0 };
  for (const profile of profiles) {
    if (profile.exam && byExam[profile.exam] !== undefined) byExam[profile.exam] += 1;
    if (profile.class_level && byClass[profile.class_level] !== undefined) byClass[profile.class_level] += 1;
  }

  const byKind = {};
  for (const item of content) {
    if (!byKind[item.kind]) byKind[item.kind] = { total: 0, active: 0 };
    byKind[item.kind].total += 1;
    if (item.active) byKind[item.kind].active += 1;
  }

  const dayCounts = {};
  const now = Date.now();
  const last14Days = [];
  for (let i = 13; i >= 0; i -= 1) {
    const date = new Date(now - i * 86400000).toISOString().slice(0, 10);
    dayCounts[date] = 0;
    last14Days.push({ date, count: 0 });
  }
  const perStudent = {};
  let totalPercentage = 0;
  const testsById = {};
  for (const item of content) if (item.kind === "test") testsById[item.id] = item;
  const subjects = {};

  for (const attempt of attempts) {
    const day = String(attempt.submitted_at || "").slice(0, 10);
    if (dayCounts[day] !== undefined) dayCounts[day] += 1;
    const pct = percentage(attempt.score, attempt.max_score);
    totalPercentage += pct;
    const uid = attempt.firebase_uid;
    if (!perStudent[uid]) perStudent[uid] = { attempts: 0, total: 0 };
    perStudent[uid].attempts += 1;
    perStudent[uid].total += pct;

    const subject = String(testsById[attempt.test_id]?.metadata?.subject || "General");
    if (!subjects[subject]) subjects[subject] = { attempts: 0, total: 0, correct: 0, incorrect: 0, unanswered: 0 };
    subjects[subject].attempts += 1;
    subjects[subject].total += pct;
    subjects[subject].correct += Number(attempt.correct_count || 0);
    subjects[subject].incorrect += Number(attempt.incorrect_count || 0);
    subjects[subject].unanswered += Number(attempt.unanswered_count || 0);
  }

  const profileByUid = {};
  for (const profile of profiles) profileByUid[profile.firebase_uid] = profile;
  const topStudents = Object.entries(perStudent)
    .map(([uid, stats]) => ({
      firebaseUid: uid,
      name: profileByUid[uid]?.display_name || "Student",
      avatarUrl: profileByUid[uid]?.avatar_url || null,
      attempts: stats.attempts,
      averagePercentage: Math.round((stats.total / stats.attempts) * 10) / 10,
    }))
    .sort((a, b) => b.averagePercentage - a.averagePercentage || b.attempts - a.attempts)
    .slice(0, 8);

  const subjectPerformance = Object.entries(subjects)
    .map(([subject, stats]) => ({
      subject,
      attempts: stats.attempts,
      averagePercentage: Math.round((stats.total / stats.attempts) * 10) / 10,
      correct: stats.correct,
      incorrect: stats.incorrect,
      unanswered: stats.unanswered,
    }))
    .sort((a, b) => b.attempts - a.attempts);

  const enrollmentCounts = {};
  for (const enrollment of enrollments) {
    if (!enrollment.active) continue;
    enrollmentCounts[enrollment.item_id] = (enrollmentCounts[enrollment.item_id] || 0) + 1;
  }
  const contentById = {};
  for (const item of content) contentById[item.id] = item;
  const enrollmentByItem = Object.entries(enrollmentCounts)
    .map(([itemId, count]) => ({
      itemId,
      title: contentById[itemId]?.title || "Untitled",
      kind: contentById[itemId]?.kind || "unknown",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  let missingThumbnails = 0;
  let testsWithoutQuestions = 0;
  let eventsMissingSchedule = 0;
  let inactiveContent = 0;
  for (const item of content) {
    if (!item.active) inactiveContent += 1;
    const meta = item.metadata || {};
    if (["batch", "series", "lecture", "resource", "test", "event"].includes(item.kind)) {
      const hasThumb = Boolean(meta.thumbnailUrl || meta.thumbnail_url || (Array.isArray(meta.images) && meta.images.length));
      if (!hasThumb) missingThumbnails += 1;
    }
    if (item.kind === "test" && (!Array.isArray(meta.questions) || meta.questions.length === 0)) testsWithoutQuestions += 1;
    if (item.kind === "event" && !meta.startsAt && !meta.starts_at) eventsMissingSchedule += 1;
  }

  return {
    students: {
      total: profiles.length,
      byExam,
      byClass,
      recent: profiles.slice(0, 8).map((profile) => ({
        firebase_uid: profile.firebase_uid,
        display_name: profile.display_name,
        email: profile.email,
        exam: profile.exam,
        class_level: profile.class_level,
        created_at: profile.created_at,
      })),
    },
    content: { total: content.length, active: content.filter((item) => item.active).length, byKind },
    attempts: {
      total: attempts.length,
      averagePercentage: attempts.length ? Math.round((totalPercentage / attempts.length) * 10) / 10 : 0,
      last14Days: last14Days.map((day) => ({ date: day.date, count: dayCounts[day.date] || 0 })),
      topStudents,
    },
    subjectPerformance,
    enrollments: { total: enrollments.filter((row) => row.active).length, byItem: enrollmentByItem },
    contentHealth: { missingThumbnails, testsWithoutQuestions, eventsMissingSchedule, inactiveContent },
  };
}

function isUuid(s) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s)); }