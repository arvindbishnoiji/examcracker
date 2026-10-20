// Exam Cracker — site platform API
// ---------------------------------------------------------------------------
// Dedicated Edge Function for the admin-controlled visual CMS, audit trail,
// enrollment administration, analytics aggregation and the per-student
// personal library. It shares the same Firebase verification contract as
// `exam-cracker-api` and the same service-role-only database access.
//
// Deployed as a separate function so the main content API can keep its
// existing, heavily used routes stable. Both functions are authorised the same
// way: a Firebase ID token is verified against Google's JWKS, then the service
// role key is used server-side. No browser ever receives a service key.

import { createClient } from "npm:@supabase/supabase-js@2";

const FIREBASE_PROJECT_ID = "darvo1";
const ADMIN_EMAIL = "arvinddarabishnoi@gmail.com";
const SITE_SETTING_KEYS = ["theme", "login", "homepage", "navigation", "footer", "banners", "popups", "testimonials", "challenges", "features", "seo", "media"];
const LIBRARY_ITEM_TYPES = new Set(["bookmark", "note", "recent", "challenge", "revision"]);
const MAX_SETTING_BYTES = 512 * 1024;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
let cachedJwks = null;
let cachedJwksExpiresAt = 0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  const url = new URL(req.url);
  if (url.pathname.endsWith("/health")) {
    return json({ ok: true, service: "Exam Cracker Site API", firebaseProjectId: FIREBASE_PROJECT_ID });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || getDefaultSecretKey();
    if (!supabaseUrl || !serviceKey) throw new Error("Server database credentials are not configured.");
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const path = normalizePath(url.pathname);
    const method = req.method.toUpperCase();

    // Public, read-only published site configuration.
    if (path === "/public/site" && method === "GET") {
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
      return json({ config, publishedAt, degraded: false });
    }

    const claims = await requireFirebaseUser(req);
    const isAdmin = String(claims.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();

    if (path === "/admin/site-settings" && method === "GET") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const { data, error } = await db.from("site_settings").select("key,draft,published,published_at,updated_at,updated_by").order("key", { ascending: true });
      if (error) throw error;
      return json({ items: data || [] });
    }

    const settingMatch = path.match(/^\/admin\/site-settings\/([a-z-]+)(?:\/(publish))?$/);
    if (settingMatch) {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const key = settingMatch[1];
      const action = settingMatch[2] || "";
      if (!SITE_SETTING_KEYS.includes(key)) return json({ error: "Unknown site settings key." }, 404);

      if (method === "GET" && !action) {
        const { data, error } = await db.from("site_settings").select("key,draft,published,published_at,updated_at,updated_by").eq("key", key).maybeSingle();
        if (error) throw error;
        return json({ item: data || { key, draft: {}, published: {}, published_at: null, updated_at: null } });
      }

      if (method === "PATCH" && !action) {
        const body = await bodyJson(req);
        const validationError = validateSettingDraft(key, body.draft);
        if (validationError) return json({ error: validationError }, 400);
        const now = new Date().toISOString();
        const { data, error } = await db.from("site_settings").upsert({
          key, draft: body.draft, updated_at: now, updated_by: claims.email || claims.sub,
        }, { onConflict: "key" }).select("key,draft,published,published_at,updated_at,updated_by").single();
        if (error) throw error;
        await logActivity(db, claims, "settings.draft.save", "site_settings", key, `Saved draft for ${key}`);
        return json({ item: data });
      }

      if (method === "POST" && action === "publish") {
        const { data: current, error: currentError } = await db.from("site_settings").select("*").eq("key", key).maybeSingle();
        if (currentError) throw currentError;
        if (!current) return json({ error: "Save a draft before publishing." }, 409);
        const draftError = validateSettingDraft(key, current.draft);
        if (draftError) return json({ error: draftError }, 400);
        const now = new Date().toISOString();
        const { data, error } = await db.from("site_settings").update({
          published: current.draft, published_at: now, updated_at: now, updated_by: claims.email || claims.sub,
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
      return json(await buildAnalytics(db));
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

    const enrollmentMatch = path.match(/^\/admin\/enrollments\/([0-9a-f-]{36})$/i);
    if (enrollmentMatch && method === "DELETE") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const { data: row, error: lookupError } = await db.from("enrollments").select("id,firebase_uid,item_type,item_id").eq("id", enrollmentMatch[1]).maybeSingle();
      if (lookupError) throw lookupError;
      if (!row) return json({ error: "Enrollment not found." }, 404);
      const { error } = await db.from("enrollments").delete().eq("id", row.id);
      if (error) throw error;
      await logActivity(db, claims, "enrollment.remove", "enrollments", row.id, `Removed enrollment ${row.firebase_uid} → ${row.item_type}:${row.item_id}`);
      return json({ removed: true });
    }

    if (path === "/library" && method === "GET") {
      const { data, error } = await db.from("student_library").select("*").eq("firebase_uid", claims.sub).order("updated_at", { ascending: false }).limit(500);
      if (error) throw error;
      return json({ items: data || [] });
    }

    if (path === "/library" && method === "POST") {
      const body = await bodyJson(req);
      const itemType = String(body.itemType || "");
      const itemId = String(body.itemId || "").trim();
      const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload : {};
      if (!LIBRARY_ITEM_TYPES.has(itemType)) return json({ error: "Invalid library item type." }, 400);
      if (!itemId || itemId.length > 200) return json({ error: "Invalid library item id." }, 400);
      if (JSON.stringify(payload).length > 20000) return json({ error: "This library item is too large." }, 400);
      const { data, error } = await db.from("student_library").upsert({
        firebase_uid: claims.sub, item_type: itemType, item_id: itemId, payload, updated_at: new Date().toISOString(),
      }, { onConflict: "firebase_uid,item_type,item_id" }).select("*").single();
      if (error) throw error;
      return json({ item: data });
    }

    const libraryMatch = path.match(/^\/library\/(bookmark|note|recent|challenge|revision)\/([^/]+)$/);
    if (libraryMatch && method === "DELETE") {
      const itemType = libraryMatch[1];
      const itemId = decodeURIComponent(libraryMatch[2]);
      if (!itemId || itemId.length > 200) return json({ error: "Invalid library item id." }, 400);
      const { error } = await db.from("student_library").delete().eq("firebase_uid", claims.sub).eq("item_type", itemType).eq("item_id", itemId);
      if (error) throw error;
      return json({ removed: true });
    }

    return json({ error: "Not found", path }, 404);
  } catch (error) {
    const message = String((error && error.message) || error || "Unexpected server error");
    if (message.indexOf("Unauthorized") >= 0) return json({ error: "Please sign in again." }, 401);
    if (message.indexOf("Server database credentials") >= 0) return json({ error: message }, 503);
    return json({ error: "Request failed.", detail: message }, 500);
  }
});

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function normalizePath(path) {
  const p = path.replace(/\/+$/, "");
  const marker = "/ec-site-api";
  const index = p.indexOf(marker);
  return (index >= 0 ? p.slice(index + marker.length) : p) || "/";
}

async function bodyJson(req) {
  try { return await req.json(); } catch (_) { throw new Error("Invalid JSON request body."); }
}

function b64urlDecode(s) {
  const v = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = v + "=".repeat((4 - (v.length % 4)) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)));
}
function base64urlToBytes(s) {
  const v = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = v + "=".repeat((4 - (v.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
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
  const now = Math.floor(Date.now() / 1000);
  if (head.alg !== "RS256" || !head.kid || claims.aud !== FIREBASE_PROJECT_ID ||
      claims.iss !== "https://securetoken.google.com/" + FIREBASE_PROJECT_ID ||
      !claims.sub || typeof claims.sub !== "string" ||
      Number(claims.exp) <= now || Number(claims.iat) > now + 300) throw new Error("Unauthorized");
  const jwks = await getFirebaseJwks();
  const jwk = jwks.find((k) => k.kid === head.kid);
  if (!jwk) throw new Error("Unauthorized");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const verified = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" }, key, base64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1])
  );
  if (!verified) throw new Error("Unauthorized");
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
function isUuid(s) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s)); }

function validateSettingDraft(key, draft) {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return "Settings must be a JSON object.";
  let serialized = "";
  try { serialized = JSON.stringify(draft); } catch (_) { return "Settings must be valid JSON."; }
  if (serialized.length > MAX_SETTING_BYTES) return "This settings document is too large.";
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const isArray = Array.isArray;
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

async function logActivity(db, claims, action, targetType, targetId, summary) {
  try {
    const { error } = await db.from("admin_activity").insert({
      actor_uid: claims.sub,
      actor_email: claims.email || "",
      action,
      target_type: targetType,
      target_id: String(targetId || ""),
      summary: String(summary || "").slice(0, 500),
      metadata: {},
    });
    if (error) return;
  } catch (_) {
    // Auditing must never block the primary write.
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

async function buildAnalytics(db) {
  const [profilesRes, contentRes, attemptsRes, enrollmentsRes] = await Promise.all([
    db.from("student_profiles").select("firebase_uid,display_name,email,exam,class_level,avatar_url,created_at").order("created_at", { ascending: false }).limit(5000),
    db.from("course_catalog").select("id,kind,title,active,exam,classes,metadata,updated_at").limit(5000),
    db.from("exam_attempts").select("firebase_uid,test_id,score,max_score,correct_count,incorrect_count,unanswered_count,submitted_at").order("submitted_at", { ascending: false }).limit(5000),
    db.from("enrollments").select("firebase_uid,item_type,item_id,active").limit(5000),
  ]);
  for (const res of [profilesRes, contentRes, attemptsRes, enrollmentsRes]) if (res.error) throw res.error;
  const profiles = profilesRes.data || [];
  const content = contentRes.data || [];
  const attempts = attemptsRes.data || [];
  const enrollments = enrollmentsRes.data || [];
  const pct = (score, maxScore) => (Number(maxScore) > 0 ? (Number(score) / Number(maxScore)) * 100 : 0);

  const byExam = { JEE: 0, NEET: 0 };
  const byClass = { "11": 0, "12": 0 };
  for (const profile of profiles) {
    if (profile.exam && byExam[profile.exam] !== undefined) byExam[profile.exam] += 1;
    if (profile.class_level && byClass[profile.class_level] !== undefined) byClass[profile.class_level] += 1;
  }

  const byKind = {};
  const testsById = {};
  let missingThumbnails = 0;
  let testsWithoutQuestions = 0;
  let eventsMissingSchedule = 0;
  let inactiveContent = 0;
  for (const item of content) {
    byKind[item.kind] = byKind[item.kind] || { total: 0, active: 0 };
    byKind[item.kind].total += 1;
    if (item.active) byKind[item.kind].active += 1;
    else inactiveContent += 1;
    if (item.kind === "test") testsById[item.id] = item;
    const meta = item.metadata || {};
    if (["batch", "series", "lecture", "resource", "test", "event"].includes(item.kind)) {
      const hasThumb = Boolean(meta.thumbnailUrl || meta.thumbnail_url || (Array.isArray(meta.images) && meta.images.length));
      if (!hasThumb) missingThumbnails += 1;
    }
    if (item.kind === "test" && (!Array.isArray(meta.questions) || meta.questions.length === 0)) testsWithoutQuestions += 1;
    if (item.kind === "event" && !meta.startsAt && !meta.starts_at) eventsMissingSchedule += 1;
  }

  const dayCounts = {};
  const last14Days = [];
  const now = Date.now();
  for (let i = 13; i >= 0; i -= 1) {
    const date = new Date(now - i * 86400000).toISOString().slice(0, 10);
    dayCounts[date] = 0;
    last14Days.push(date);
  }
  const perStudent = {};
  const subjects = {};
  let totalPct = 0;
  for (const attempt of attempts) {
    const day = String(attempt.submitted_at || "").slice(0, 10);
    if (dayCounts[day] !== undefined) dayCounts[day] += 1;
    const value = pct(attempt.score, attempt.max_score);
    totalPct += value;
    const uid = attempt.firebase_uid;
    if (!perStudent[uid]) perStudent[uid] = { attempts: 0, total: 0 };
    perStudent[uid].attempts += 1;
    perStudent[uid].total += value;
    const subject = String(testsById[attempt.test_id]?.metadata?.subject || "General");
    if (!subjects[subject]) subjects[subject] = { attempts: 0, total: 0, correct: 0, incorrect: 0, unanswered: 0 };
    subjects[subject].attempts += 1;
    subjects[subject].total += value;
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
  const byItem = Object.entries(enrollmentCounts)
    .map(([itemId, count]) => ({
      itemId,
      title: contentById[itemId]?.title || "Untitled",
      kind: contentById[itemId]?.kind || "unknown",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    students: {
      total: profiles.length,
      byExam,
      byClass,
      recent: profiles.slice(0, 8),
    },
    content: { total: content.length, active: content.filter((item) => item.active).length, byKind },
    attempts: {
      total: attempts.length,
      averagePercentage: attempts.length ? Math.round((totalPct / attempts.length) * 10) / 10 : 0,
      last14Days: last14Days.map((date) => ({ date, count: dayCounts[date] || 0 })),
      topStudents,
    },
    subjectPerformance,
    enrollments: { total: enrollments.filter((row) => row.active).length, byItem },
    contentHealth: { missingThumbnails, testsWithoutQuestions, eventsMissingSchedule, inactiveContent },
  };
}
