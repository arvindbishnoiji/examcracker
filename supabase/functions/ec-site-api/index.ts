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
import {
  BULK_CHUNK_SIZE,
  MAX_BULK_STUDENTS,
  enrollmentIsActive,
  isEligibleForItem,
  isUuid,
  normalizeStudentUids,
  parseBulkEnrollInput,
  resolveAudience,
  summarizeBulkResults,
  type EnrollmentItemType,
  type StudentLike,
} from "../_shared/enrollment-core.ts";

const FIREBASE_PROJECT_ID = "darvo1";
const ADMIN_EMAIL = (Deno.env.get("ADMIN_EMAIL") || "arvinddarabishnoi@gmail.com").toLowerCase();
const MAX_BODY_BYTES = 512 * 1024;
const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;
const SITE_SETTING_KEYS = ["theme", "login", "homepage", "navigation", "footer", "banners", "popups", "testimonials", "challenges", "features", "seo", "media"];
const LIBRARY_ITEM_TYPES = new Set(["bookmark", "note", "recent", "challenge", "revision"]);
const MAX_SETTING_BYTES = 512 * 1024;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
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
      return await adminListEnrollments(db, url);
    }

    if (path === "/admin/enrollments" && method === "POST") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      return await adminGrantEnrollment(db, claims, await bodyJson(req));
    }

    if (path === "/admin/enrollments/bulk" && method === "POST") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      if (rateLimited(`bulk:${claims.sub}`, 12, 300_000)) return json(RATE_LIMITED_BODY, 429);
      return await adminBulkEnroll(db, claims, await bodyJson(req));
    }

    if (path === "/admin/enrollments/bulk-revoke" && method === "POST") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      if (rateLimited(`revoke:${claims.sub}`, 12, 300_000)) return json(RATE_LIMITED_BODY, 429);
      return await adminBulkRevoke(db, claims, await bodyJson(req));
    }

    if (path === "/admin/enrollments/history" && method === "GET") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const limit = Math.max(1, Math.min(300, Number(url.searchParams.get("limit") || 120) || 120));
      return await adminEnrollmentHistory(db, limit);
    }

    if (path === "/admin/enrollment-rules" && method === "GET") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      return await adminListEnrollmentRules(db);
    }

    const ruleMatch = path.match(/^\/admin\/enrollment-rules\/([0-9a-f-]{36})$/i);
    if (ruleMatch && method === "PATCH") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const body = await bodyJson(req);
      const active = body.active === true;
      const { data, error } = await db.from("enrollment_rules")
        .update({ active, updated_at: new Date().toISOString() })
        .eq("id", ruleMatch[1]).select("*").maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Enrollment rule not found." }, 404);
      await logActivity(db, claims, active ? "enrollment_rule.enable" : "enrollment_rule.disable", "enrollment_rules", data.id, `${active ? "Enabled" : "Paused"} future auto-enrollment for ${data.item_type}:${data.item_id}`);
      return json({ item: data });
    }
    if (ruleMatch && method === "DELETE") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      const { data, error } = await db.from("enrollment_rules").delete().eq("id", ruleMatch[1]).select("id,item_type,item_id").maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Enrollment rule not found." }, 404);
      await logActivity(db, claims, "enrollment_rule.delete", "enrollment_rules", data.id, `Deleted auto-enrollment rule for ${data.item_type}:${data.item_id}`);
      return json({ removed: true });
    }

    const enrollmentMatch = path.match(/^\/admin\/enrollments\/([0-9a-f-]{36})(?:\/(restore))?$/i);
    if (enrollmentMatch && method === "DELETE" && !enrollmentMatch[2]) {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      return await adminRevokeEnrollment(db, claims, enrollmentMatch[1]);
    }
    if (enrollmentMatch && method === "POST" && enrollmentMatch[2] === "restore") {
      if (!isAdmin) return json({ error: "Admin access denied." }, 403);
      return await adminRestoreEnrollment(db, claims, enrollmentMatch[1], await bodyJson(req));
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
    if (message.indexOf("Invalid JSON") >= 0) return json({ error: "The request body is not valid JSON." }, 400);
    if (message.indexOf("Request body is too large") >= 0) return json({ error: message }, 413);
    // Never leak database/stack details to the browser unless explicitly enabled
    // for a local debugging session.
    const debug = Deno.env.get("DEBUG_API_ERRORS") === "1";
    return json(debug ? { error: "Request failed.", detail: message } : { error: "Request failed. Please try again." }, 500);
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
  const declared = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new Error("Request body is too large.");
  }
  let text;
  try { text = await req.text(); } catch (_) { throw new Error("Invalid JSON request body."); }
  if (text.length > MAX_BODY_BYTES) throw new Error("Request body is too large.");
  if (!text) return {};
  try { return JSON.parse(text); } catch (_) { throw new Error("Invalid JSON request body."); }
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
    status: row.status || (row.active ? "active" : "revoked"),
    source: row.source || "manual",
    expires_at: row.expires_at || null,
    revoked_at: row.revoked_at || null,
    updated_at: row.updated_at || row.created_at,
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

// ===========================================================================
// Enrollment administration helpers
// ---------------------------------------------------------------------------
// Every helper below is only reachable after `isAdmin` has been verified from
// the Firebase ID token. They never trust a client-provided role. Bulk actions
// are validated with the shared, unit-tested enrollment core before writing.
// ===========================================================================

function isMissingColumn(error) {
  const code = String(error && error.code || "");
  const message = String(error && error.message || "");
  return code === "42703" || (message.includes("column") && message.includes("does not exist"));
}

function isMissingRelation(error) {
  const code = String(error && error.code || "");
  const message = String(error && error.message || "");
  return code === "42P01" || message.includes("does not exist");
}

function parseExpiry(raw) {
  if (!raw) return { value: null, error: "" };
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) return { value: null, error: "The access expiry date is not valid." };
  if (date.getTime() <= Date.now()) return { value: null, error: "The access expiry date must be in the future." };
  return { value: date.toISOString(), error: "" };
}

async function getEnrollmentItem(db, itemId) {
  const { data, error } = await db.from("course_catalog")
    .select("id,kind,title,exam,classes,active,access_code,metadata")
    .eq("id", itemId).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function getEnrollmentStudent(db, uid) {
  const { data, error } = await db.from("student_profiles")
    .select("firebase_uid,display_name,email,exam,class_level")
    .eq("firebase_uid", uid).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function fetchProfilesByUids(db, uids) {
  const out = [];
  for (const chunk of chunkList(uids, 100)) {
    const { data, error } = await db.from("student_profiles")
      .select("firebase_uid,display_name,email,exam,class_level")
      .in("firebase_uid", chunk);
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}

async function fetchAudienceProfiles(db, input) {
  if (input.mode === "selected") return fetchProfilesByUids(db, input.studentUids);
  const out = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 10000; offset += pageSize) {
    let query = db.from("student_profiles")
      .select("firebase_uid,display_name,email,exam,class_level")
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (input.filterExam) query = query.eq("exam", input.filterExam);
    if (input.filterClass) query = query.eq("class_level", input.filterClass);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

function chunkList(items, size) {
  const out = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

async function mapWithConcurrency(items, limit, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

async function countEnrollments(db, itemId, status) {
  let query = db.from("enrollments").select("id", { count: "exact", head: true });
  if (itemId) query = query.eq("item_id", itemId);
  if (status === "active") {
    query = query.eq("active", true).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  } else if (status === "revoked") {
    query = query.eq("active", false);
  }
  const { count, error } = await query;
  if (error) {
    if (!isMissingColumn(error)) throw error;
    let legacy = db.from("enrollments").select("id", { count: "exact", head: true });
    if (itemId) legacy = legacy.eq("item_id", itemId);
    if (status === "active") legacy = legacy.eq("active", true);
    if (status === "revoked") legacy = legacy.eq("active", false);
    const fallback = await legacy;
    if (fallback.error) throw fallback.error;
    return fallback.count || 0;
  }
  return count || 0;
}

async function adminListEnrollments(db, url) {
  const page = Math.max(1, Math.floor(Number(url.searchParams.get("page") || 1) || 1));
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Math.floor(Number(url.searchParams.get("pageSize") || PAGE_SIZE_DEFAULT) || PAGE_SIZE_DEFAULT)));
  const statusFilter = String(url.searchParams.get("status") || "all");
  const itemId = String(url.searchParams.get("itemId") || "").trim();
  const itemType = String(url.searchParams.get("itemType") || "").trim();
  const search = String(url.searchParams.get("query") || url.searchParams.get("student") || "").trim().toLowerCase();
  const itemSearch = String(url.searchParams.get("item") || "").trim().toLowerCase();

  let uidFilter = null;
  if (search) {
    const safe = search.replace(/[,()%_]/g, "").slice(0, 80);
    if (!safe) return json({ items: [], total: 0, page, pageSize, counts: { active: 0, revoked: 0, total: 0 } });
    const { data: profiles, error: searchError } = await db.from("student_profiles")
      .select("firebase_uid")
      .or(`display_name.ilike.%${safe}%,email.ilike.%${safe}%,firebase_uid.eq.${safe}`)
      .limit(500);
    if (searchError) throw searchError;
    uidFilter = (profiles || []).map((row) => row.firebase_uid);
    if (!uidFilter.length) return json({ items: [], total: 0, page, pageSize, counts: { active: await countEnrollments(db, itemId, "active"), revoked: await countEnrollments(db, itemId, "revoked"), total: await countEnrollments(db, itemId, "all") } });
  }

  let query = db.from("enrollments").select("*", { count: "exact" });
  if (itemId && isUuid(itemId)) query = query.eq("item_id", itemId);
  if (itemType === "batch" || itemType === "series") query = query.eq("item_type", itemType);
  if (statusFilter === "active") {
    query = query.eq("active", true).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  } else if (statusFilter === "revoked") {
    query = query.eq("active", false);
  }
  if (uidFilter) query = query.in("firebase_uid", uidFilter);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
  if (error) {
    if (!isMissingColumn(error) && !isMissingRelation(error)) throw error;
    return await adminListEnrollmentsLegacy(db, { page, pageSize, search, itemSearch, itemId });
  }
  let items = await hydrateEnrollments(db, data || []);
  if (itemSearch) {
    items = items.filter((row) => `${row.item_title || ""} ${row.item_id}`.toLowerCase().includes(itemSearch));
  }
  return json({
    items,
    total: count || items.length,
    page,
    pageSize,
    counts: {
      active: await countEnrollments(db, itemId, "active"),
      revoked: await countEnrollments(db, itemId, "revoked"),
      total: await countEnrollments(db, itemId, "all"),
    },
  });
}

async function adminListEnrollmentsLegacy(db, opts) {
  const { data, error } = await db.from("enrollments").select("*").order("created_at", { ascending: false }).limit(5000);
  if (error) throw error;
  let items = await hydrateEnrollments(db, data || []);
  if (opts.search) {
    items = items.filter((row) => `${row.student_name || ""} ${row.student_email || ""} ${row.firebase_uid}`.toLowerCase().includes(opts.search));
  }
  if (opts.itemSearch) {
    items = items.filter((row) => `${row.item_title || ""} ${row.item_id}`.toLowerCase().includes(opts.itemSearch));
  }
  const start = (opts.page - 1) * opts.pageSize;
  return json({
    items: items.slice(start, start + opts.pageSize),
    total: items.length,
    page: opts.page,
    pageSize: opts.pageSize,
    counts: { active: items.filter((row) => row.active).length, revoked: items.filter((row) => !row.active).length, total: items.length },
    degraded: true,
  });
}

async function recordEnrollmentEvents(db, events) {
  for (const chunk of chunkList(events, 200)) {
    try {
      const { error } = await db.from("enrollment_events").insert(chunk);
      if (error && !isMissingRelation(error)) throw error;
      if (error) return;
    } catch (_) {
      // The audit trail must never block the primary enrollment write.
      return;
    }
  }
}

async function adminGrantEnrollment(db, claims, body) {
  const studentUid = String(body.studentUid || "").trim();
  const itemType = String(body.itemType || "");
  const itemId = String(body.itemId || "");
  if (!studentUid) return json({ error: "Choose a student." }, 400);
  if (!["batch", "series"].includes(itemType) || !isUuid(itemId)) return json({ error: "Choose a valid batch or series." }, 400);
  const student = await getEnrollmentStudent(db, studentUid);
  if (!student) return json({ error: "Student not found." }, 404);
  const item = await getEnrollmentItem(db, itemId);
  if (!item || item.kind !== itemType) return json({ error: "That batch or series does not exist." }, 404);
  const respectEligibility = body.respectEligibility !== false && body.overrideEligibility !== true;
  if (respectEligibility && !isEligibleForItem(item, student)) {
    return json({
      error: "This student's exam/class does not match the course. Confirm the override to enroll anyway.",
      code: "INELIGIBLE",
    }, 409);
  }
  const expiry = parseExpiry(body.expiresAt);
  if (expiry.error) return json({ error: expiry.error }, 400);
  const now = new Date().toISOString();
  const { data: existing, error: lookupError } = await db.from("enrollments")
    .select("id,active,status,expires_at")
    .eq("firebase_uid", studentUid).eq("item_type", itemType).eq("item_id", itemId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  const payload = {
    firebase_uid: studentUid,
    item_type: itemType,
    item_id: itemId,
    active: true,
    status: "active",
    source: "manual",
    granted_by: claims.email || claims.sub,
    expires_at: expiry.value,
    revoked_at: null,
    updated_at: now,
  };
  const { data: row, error } = await db.from("enrollments")
    .upsert(payload, { onConflict: "firebase_uid,item_type,item_id" })
    .select("*").single();
  if (error) throw error;
  const action = !existing ? "granted" : existing.active === false || existing.status === "revoked" || String(existing.expires_at || "") !== String(expiry.value || "") ? "reactivated" : "granted";
  if (!existing || existing.active === false || existing.status !== "active" || String(existing.expires_at || "") !== String(expiry.value || "")) {
    await recordEnrollmentEvents(db, [{
      enrollment_id: row.id,
      firebase_uid: studentUid,
      item_type: itemType,
      item_id: itemId,
      action,
      source: "manual",
      actor_uid: claims.sub,
      actor_email: claims.email || "",
      detail: { title: item.title, expiresAt: expiry.value, eligibilityOverride: !respectEligibility },
    }]);
  }
  await logActivity(db, claims, "enrollment.create", "enrollments", row.id,
    `Enrolled ${student.display_name || studentUid} in ${item.title}${!respectEligibility ? " (eligibility override)" : ""}`);
  const hydrated = await hydrateEnrollments(db, [row]);
  return json({ item: hydrated[0], created: !existing }, existing ? 200 : 201);
}

async function processGrantRows(db, { eligible, item, input, claims, source }) {
  const itemType = item.kind;
  const now = new Date().toISOString();
  const existingByUid = new Map();
  for (const chunk of chunkList(eligible.map((student) => student.firebase_uid), 100)) {
    const { data, error } = await db.from("enrollments")
      .select("id,firebase_uid,active,status,expires_at,revoked_at")
      .eq("item_type", itemType).eq("item_id", item.id).in("firebase_uid", chunk);
    if (error) throw error;
    for (const row of data || []) existingByUid.set(row.firebase_uid, row);
  }

  let created = 0;
  let reactivated = 0;
  let alreadyActive = 0;
  let failed = 0;
  const failures = [];
  const events = [];

  const rows = eligible.map((student) => {
    const existing = existingByUid.get(student.firebase_uid);
    return {
      firebase_uid: student.firebase_uid,
      item_type: itemType,
      item_id: item.id,
      active: true,
      status: "active",
      source,
      granted_by: claims.email || claims.sub,
      expires_at: input.expiresAt || null,
      revoked_at: null,
      updated_at: now,
      _existing: existing || null,
      _name: student.display_name || null,
    };
  });

  function classify(row) {
    if (!row._existing) {
      created += 1;
      events.push(buildGrantEvent(row, "granted", claims, item, input));
      return;
    }
    if (enrollmentIsActive(row._existing)) {
      alreadyActive += 1;
      return;
    }
    reactivated += 1;
    events.push(buildGrantEvent(row, "reactivated", claims, item, input));
  }

  const writeChunk = async (chunk) => {
    const clean = chunk.map(({ _existing, _name, ...rest }) => rest);
    const { error } = await db.from("enrollments").upsert(clean, { onConflict: "firebase_uid,item_type,item_id" });
    if (!error) {
      for (const row of chunk) classify(row);
      return;
    }
    // Partial-failure resilience: retry each row so one bad record cannot lose
    // the whole batch. The failure reasons are returned to the admin.
    for (const row of chunk) {
      const single = await db.from("enrollments")
        .upsert(clean[chunk.indexOf(row)], { onConflict: "firebase_uid,item_type,item_id" });
      if (single.error) {
        failed += 1;
        failures.push({ uid: row.firebase_uid, name: row._name, reason: String(single.error.message || "write failed").slice(0, 240) });
      } else {
        classify(row);
      }
    }
  };

  const chunks = chunkList(rows, 100);
  await mapWithConcurrency(chunks, 4, writeChunk);
  await recordEnrollmentEvents(db, events);

  return {
    summary: summarizeBulkResults({
      targeted: input.audienceTargeted ?? eligible.length,
      eligible: eligible.length,
      skipped: input.audienceSkipped ?? 0,
      created,
      reactivated,
      alreadyActive,
      failed,
    }),
    failures: failures.slice(0, 50),
  };
}

function buildGrantEvent(row, action, claims, item, input) {
  return {
    enrollment_id: null,
    firebase_uid: row.firebase_uid,
    item_type: item.kind,
    item_id: item.id,
    action,
    source: input.source || "admin_bulk",
    actor_uid: claims.sub,
    actor_email: claims.email || "",
    detail: {
      title: item.title,
      expiresAt: input.expiresAt || null,
      includeFuture: Boolean(input.includeFuture),
      eligibilityOverride: !input.respectEligibility,
    },
  };
}

async function saveEnrollmentRule(db, claims, item, input) {
  try {
    const { data, error } = await db.from("enrollment_rules").upsert({
      item_type: item.kind,
      item_id: item.id,
      name: String(item.title || "").slice(0, 180),
      include_future: true,
      respect_eligibility: input.respectEligibility !== false,
      filter_exam: input.exam || "",
      filter_class: input.classLevel || "",
      expires_at: input.expiresAt || null,
      active: true,
      created_by: claims.email || claims.sub,
      updated_at: new Date().toISOString(),
      last_applied_at: new Date().toISOString(),
      last_applied_count: input.appliedCount || 0,
    }, { onConflict: "item_type,item_id" }).select("*").single();
    if (error) return { rule: null, error: String(error.message || "rule save failed") };
    return { rule: data, error: "" };
  } catch (error) {
    return { rule: null, error: String(error && error.message || "rule save failed") };
  }
}

async function adminBulkEnroll(db, claims, body) {
  const parsed = parseBulkEnrollInput(body);
  if (!parsed.ok || !parsed.value) return json({ error: parsed.error || "Invalid enrollment request." }, 400);
  const input = parsed.value;
  const item = await getEnrollmentItem(db, input.itemId);
  if (!item || item.kind !== input.itemType) return json({ error: "That batch or series does not exist." }, 404);
  if (item.active === false) return json({ error: "Activate this course before enrolling students." }, 409);

  const profiles = await fetchAudienceProfiles(db, {
    mode: input.mode,
    studentUids: input.studentUids,
    filterExam: input.exam,
    filterClass: input.classLevel,
  });
  const plan = resolveAudience(input, profiles, item);

  if (plan.scope.requiresConfirmation && !input.confirmAll) {
    return json({
      error: "This audience goes beyond the course's exam/class. Confirm the full scope to continue.",
      code: "CONFIRMATION_REQUIRED",
      scope: plan.scope,
    }, 409);
  }

  if (input.dryRun) {
    return json({
      dryRun: true,
      scope: plan.scope,
      preview: {
        eligible: plan.eligible.length,
        skipped: plan.skipped.length,
        sampleSkipped: plan.skipped.slice(0, 20),
      },
    });
  }

  if (!plan.eligible.length) {
    let emptyRule = null;
    let emptyRuleError = "";
    if (input.includeFuture) {
      const saved = await saveEnrollmentRule(db, claims, item, { ...input, appliedCount: 0 });
      emptyRule = saved.rule;
      emptyRuleError = saved.error;
    }
    return json({
      summary: summarizeBulkResults({ targeted: plan.scope.targeted, eligible: 0, skipped: plan.skipped.length, created: 0, reactivated: 0, alreadyActive: 0, failed: 0, ruleSaved: Boolean(emptyRule) }),
      scope: plan.scope,
      skipped: plan.skipped.slice(0, 100),
      failures: [],
      rule: emptyRule,
      ruleError: emptyRuleError || null,
    });
  }

  const processed = await processGrantRows(db, {
    eligible: plan.eligible,
    item,
    input: {
      ...input,
      source: "admin_bulk",
      audienceTargeted: plan.scope.targeted,
      audienceSkipped: plan.skipped.length,
    },
    claims,
    source: "admin_bulk",
  });

  let rule = null;
  let ruleError = "";
  if (input.includeFuture) {
    const saved = await saveEnrollmentRule(db, claims, item, {
      ...input,
      appliedCount: processed.summary.created + processed.summary.reactivated,
    });
    rule = saved.rule;
    ruleError = saved.error;
  }

  processed.summary.ruleSaved = Boolean(rule);
  await logActivity(db, claims, "enrollment.bulk", "course_catalog", item.id,
    `Bulk enrollment in ${item.title}: ${processed.summary.created} new, ${processed.summary.reactivated} reactivated, ${processed.summary.alreadyActive} already active, ${processed.summary.failed} failed, ${processed.summary.skipped} skipped${rule ? " · future auto-enrollment on" : ""}`);

  return json({
    summary: processed.summary,
    scope: plan.scope,
    skipped: plan.skipped.slice(0, 100),
    failures: processed.failures,
    rule,
    ruleError: ruleError || null,
  });
}

async function adminBulkRevoke(db, claims, body) {
  const itemType = String(body.itemType || "");
  const itemId = String(body.itemId || "");
  if (!["batch", "series"].includes(itemType) || !isUuid(itemId)) return json({ error: "Choose a valid batch or series." }, 400);
  if (body.confirm !== "REVOKE") return json({ error: "Type REVOKE to confirm a bulk access removal." }, 400);
  const uids = normalizeStudentUids(body.studentUids);
  if (!uids.length) return json({ error: "Choose at least one enrollment." }, 400);
  if (uids.length > MAX_BULK_STUDENTS) return json({ error: `Revoke ${MAX_BULK_STUDENTS} students or fewer at a time.` }, 400);
  const now = new Date().toISOString();
  let revoked = 0;
  let failed = 0;
  const events = [];
  for (const chunk of chunkList(uids, 100)) {
    const { data, error } = await db.from("enrollments")
      .update({ active: false, status: "revoked", revoked_at: now, updated_at: now })
      .eq("item_type", itemType).eq("item_id", itemId).in("firebase_uid", chunk).eq("active", true)
      .select("id,firebase_uid");
    if (error) {
      failed += chunk.length;
      continue;
    }
    revoked += (data || []).length;
    for (const row of data || []) {
      events.push({
        enrollment_id: row.id,
        firebase_uid: row.firebase_uid,
        item_type: itemType,
        item_id: itemId,
        action: "revoked",
        source: "admin_bulk",
        actor_uid: claims.sub,
        actor_email: claims.email || "",
        detail: { bulk: true },
      });
    }
  }
  await recordEnrollmentEvents(db, events);
  await logActivity(db, claims, "enrollment.bulk_revoke", "course_catalog", itemId,
    `Bulk revoked ${revoked} enrollment(s)${failed ? ` · ${failed} failed` : ""}`);
  return json({ revoked, failed });
}

async function adminRevokeEnrollment(db, claims, id) {
  const { data: row, error: lookupError } = await db.from("enrollments")
    .select("id,firebase_uid,item_type,item_id,active,status")
    .eq("id", id).maybeSingle();
  if (lookupError) throw lookupError;
  if (!row) return json({ error: "Enrollment not found." }, 404);
  if (!row.active && row.status === "revoked") return json({ removed: true, alreadyRevoked: true });
  const now = new Date().toISOString();
  const { data, error } = await db.from("enrollments").update({
    active: false, status: "revoked", revoked_at: now, updated_at: now,
  }).eq("id", row.id).select("*").single();
  if (error) throw error;
  await recordEnrollmentEvents(db, [{
    enrollment_id: row.id,
    firebase_uid: row.firebase_uid,
    item_type: row.item_type,
    item_id: row.item_id,
    action: "revoked",
    source: "manual",
    actor_uid: claims.sub,
    actor_email: claims.email || "",
    detail: {},
  }]);
  await logActivity(db, claims, "enrollment.remove", "enrollments", row.id,
    `Revoked ${row.firebase_uid} → ${row.item_type}:${row.item_id}`);
  return json({ removed: true, item: data });
}

async function adminRestoreEnrollment(db, claims, id, body) {
  const { data: row, error: lookupError } = await db.from("enrollments")
    .select("id,firebase_uid,item_type,item_id,active,status")
    .eq("id", id).maybeSingle();
  if (lookupError) throw lookupError;
  if (!row) return json({ error: "Enrollment not found." }, 404);
  const [student, item] = await Promise.all([
    getEnrollmentStudent(db, row.firebase_uid),
    getEnrollmentItem(db, row.item_id),
  ]);
  if (!student || !item) return json({ error: "The student or course no longer exists." }, 409);
  if (!isEligibleForItem(item, student) && body.force !== true) {
    return json({ error: "This student no longer matches the course exam/class. Confirm the override to restore access.", code: "INELIGIBLE" }, 409);
  }
  const expiry = parseExpiry(body.expiresAt);
  if (expiry.error) return json({ error: expiry.error }, 400);
  const now = new Date().toISOString();
  const { data, error } = await db.from("enrollments").update({
    active: true, status: "active", revoked_at: null,
    expires_at: expiry.value, updated_at: now,
    granted_by: claims.email || claims.sub,
  }).eq("id", row.id).select("*").single();
  if (error) throw error;
  await recordEnrollmentEvents(db, [{
    enrollment_id: row.id,
    firebase_uid: row.firebase_uid,
    item_type: row.item_type,
    item_id: row.item_id,
    action: "reactivated",
    source: "manual",
    actor_uid: claims.sub,
    actor_email: claims.email || "",
    detail: { title: item.title, eligibilityOverride: !isEligibleForItem(item, student) },
  }]);
  await logActivity(db, claims, "enrollment.restore", "enrollments", row.id,
    `Restored ${row.firebase_uid} → ${item.title}`);
  return json({ item: data });
}

async function adminEnrollmentHistory(db, limit) {
  const { data: events, error } = await db.from("enrollment_events")
    .select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) {
    if (isMissingRelation(error)) return json({ items: [], unavailable: true });
    throw error;
  }
  const rows = events || [];
  const uids = Array.from(new Set(rows.map((row) => row.firebase_uid).filter(Boolean)));
  const itemIds = Array.from(new Set(rows.map((row) => row.item_id).filter(Boolean)));
  const names = {};
  const titles = {};
  for (const chunk of chunkList(uids, 100)) {
    const { data, error: profileError } = await db.from("student_profiles")
      .select("firebase_uid,display_name,email").in("firebase_uid", chunk);
    if (profileError) throw profileError;
    for (const profile of data || []) names[profile.firebase_uid] = profile;
  }
  if (itemIds.length) {
    const { data, error: itemError } = await db.from("course_catalog")
      .select("id,title").in("id", itemIds);
    if (itemError) throw itemError;
    for (const item of data || []) titles[item.id] = item.title;
  }
  return json({
    items: rows.map((row) => ({
      ...row,
      student_name: names[row.firebase_uid]?.display_name || null,
      student_email: names[row.firebase_uid]?.email || null,
      item_title: titles[row.item_id] || null,
    })),
  });
}

async function adminListEnrollmentRules(db) {
  const { data: rules, error } = await db.from("enrollment_rules")
    .select("*").order("created_at", { ascending: false }).limit(500);
  if (error) {
    if (isMissingRelation(error)) return json({ items: [], unavailable: true });
    throw error;
  }
  const rows = rules || [];
  const itemIds = Array.from(new Set(rows.map((row) => row.item_id).filter(Boolean)));
  const titles = {};
  if (itemIds.length) {
    const { data, error: itemError } = await db.from("course_catalog").select("id,title,active").in("id", itemIds);
    if (itemError) throw itemError;
    for (const item of data || []) titles[item.id] = item;
  }
  return json({
    items: rows.map((row) => ({
      ...row,
      item_title: titles[row.item_id]?.title || null,
      item_active: titles[row.item_id]?.active ?? null,
    })),
  });
}
