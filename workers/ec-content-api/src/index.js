export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=180"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const respond = (body, status) => new Response(JSON.stringify(body), { status: status || 200, headers: cors });
    if (url.pathname === "/health") return respond({ ok: true, service: "Exam Cracker YouTube metadata proxy", youtubeDataApiKeyRequired: false });
    if (request.method !== "GET") return respond({ error: "Method not allowed" }, 405);
    if (url.pathname === "/thumbnail") {
      const videoId = String(url.searchParams.get("videoId") || "").trim();
      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return new Response("Invalid YouTube video ID", { status: 400, headers: { ...cors, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
      }
      const candidates = ["mqdefault.jpg", "hqdefault.jpg", "sddefault.jpg", "0.jpg"];
      for (const file of candidates) {
        try {
          const upstream = await fetch("https://i.ytimg.com/vi/" + encodeURIComponent(videoId) + "/" + file, {
            headers: { "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8", "User-Agent": "Mozilla/5.0 (compatible; ExamCracker/1.0)" },
            cf: { cacheTtl: 86400, cacheEverything: true }
          });
          const type = upstream.headers.get("content-type") || "";
          if (upstream.ok && type.startsWith("image/")) {
            const headers = new Headers(upstream.headers);
            headers.set("Access-Control-Allow-Origin", "*");
            headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
            headers.set("X-Thumbnail-Source", "youtube");
            return new Response(upstream.body, { status: 200, headers });
          }
        } catch (_) {}
      }
      return new Response("Thumbnail unavailable for this video", { status: 404, headers: { ...cors, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" } });
    }
    if (url.pathname === "/video") {
      const videoUrl = url.searchParams.get("url") || "";
      const videoId = getVideoId(videoUrl);
      if (!videoId) return respond({ error: "Provide a valid YouTube video URL." }, 400);
      try {
        const r = await fetch("https://www.youtube.com/oembed?url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + videoId) + "&format=json", {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; ExamCracker/1.0)" }
        });
        if (!r.ok) return respond({ error: "YouTube could not return metadata for this video." }, r.status);
        const d = await r.json();
        return respond({ videoId, title: d.title, author: d.author_name, thumbnail: d.thumbnail_url, provider: d.provider_name,
          watchUrl: "https://www.youtube.com/watch?v=" + videoId });
      } catch (_) { return respond({ error: "Unable to reach YouTube metadata service." }, 502); }
    }
    if (url.pathname === "/playlist") {
      const playlistUrl = url.searchParams.get("url") || "";
      const playlistId = getPlaylistId(playlistUrl);
      if (!playlistId) return respond({ error: "Provide a valid YouTube playlist URL containing a list= ID." }, 400);
      const cursorRaw = url.searchParams.get("cursor") || "";
      const requestedLimit = Number(url.searchParams.get("limit") || 200);
      const limit = Math.max(1, Math.min(500, Number.isFinite(requestedLimit) ? requestedLimit : 200));
      const instances = [
        "https://inv.nadeko.net",
        "https://invidious.nerdvpn.de",
        "https://invidious.privacyredirect.com",
        "https://invidious.f5.si"
      ];
      let pageNumber = 1;
      let preferredInstance = "";
      if (cursorRaw) {
        const cursor = decodeCursor(cursorRaw);
        if (cursor && typeof cursor === "object" && cursor.provider === "invidious") {
          pageNumber = Math.max(2, Number(cursor.page) || 2);
          preferredInstance = instances.includes(cursor.instance) ? cursor.instance : "";
        } else {
          // Legacy YouTube cursors cannot be resumed reliably without Innertube context.
          // The app deduplicates IDs already collected when this page-based fallback continues.
          pageNumber = 2;
        }
      }
      const orderedInstances = preferredInstance
        ? [preferredInstance, ...instances.filter((instance) => instance !== preferredInstance)]
        : instances;
      const failures = [];
      for (const instance of orderedInstances) {
        try {
          const endpoint = instance + "/api/v1/playlists/" + encodeURIComponent(playlistId) + "?page=" + pageNumber;
          const upstream = await fetch(endpoint, {
            headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 (compatible; ExamCracker/1.0)" },
            cf: { cacheTtl: 120, cacheEverything: true }
          });
          if (!upstream.ok) {
            failures.push(instance + " returned HTTP " + upstream.status);
            continue;
          }
          const data = await upstream.json();
          if (!data || !Array.isArray(data.videos)) {
            failures.push(instance + " returned an unsupported playlist response");
            continue;
          }
          const rawVideos = data.videos.slice(0, limit);
          const items = rawVideos.map((video, index) => {
            const videoId = String(video.videoId || "");
            const thumbnails = Array.isArray(video.videoThumbnails) ? video.videoThumbnails : [];
            const chosen = thumbnails.find((thumbnail) => thumbnail && /medium|high|maxres/i.test(String(thumbnail.quality || ""))) || thumbnails[thumbnails.length - 1];
            const upstreamThumbnail = chosen && chosen.url
              ? (String(chosen.url).startsWith("//") ? "https:" + chosen.url : String(chosen.url).startsWith("/") ? "https://www.youtube.com" + chosen.url : String(chosen.url))
              : "";
            const thumbnail = /^[a-zA-Z0-9_-]{11}$/.test(videoId)
              ? url.origin + "/thumbnail?videoId=" + encodeURIComponent(videoId)
              : upstreamThumbnail;
            const seconds = Number(video.lengthSeconds ?? video.duration ?? 0);
            return {
              videoId,
              title: String(video.title || "YouTube video"),
              description: String(video.description || ""),
              thumbnail,
              duration: Number.isFinite(seconds) && seconds > 0 ? formatDuration(seconds) : String(video.duration || ""),
              position: (pageNumber - 1) * rawVideos.length + index,
              watchUrl: "https://www.youtube.com/watch?v=" + encodeURIComponent(videoId) + "&list=" + encodeURIComponent(playlistId)
            };
          }).filter((video) => /^[a-zA-Z0-9_-]{11}$/.test(video.videoId));
          const hasMore = Boolean(data.continuation || data.nextpage || rawVideos.length >= Math.min(limit, 100));
          const nextCursor = hasMore
            ? encodeCursor(JSON.stringify({ provider: "invidious", instance, page: pageNumber + 1 }))
            : null;
          return respond({
            playlistId: data.playlistId || playlistId,
            title: data.title || "Imported YouTube Playlist",
            count: items.length,
            items,
            nextCursor,
            hasMore,
            youtubeDataApiKeyRequired: false,
            note: "Playlist loaded through a public Invidious-compatible source. Private, restricted, removed, and region-blocked videos may be unavailable."
          });
        } catch (error) {
          failures.push(instance + ": " + (error instanceof Error ? error.message : "request failed"));
        }
      }
      return respond({
        error: "All public playlist sources failed. Retry the import in a moment, or verify that the playlist is public.",
        details: failures.slice(0, 4)
      }, 502);
    }
    return respond({ error: "Not found", endpoints: ["/health", "/video?url=...", "/playlist?url=...&limit=200&cursor=..."] }, 404);
  }
};

function getVideoId(value) {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    if (host === "youtu.be") return u.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v") || "";
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/]+)/);
      if (m) return m[2];
    }
  } catch (_) {}
  return "";
}
function getPlaylistId(value) {
  try {
    const u = new URL(value);
    if (!/(^|\.)youtube\.com$/.test(u.hostname) && u.hostname !== "youtu.be") return "";
    return u.searchParams.get("list") || "";
  } catch (_) { return ""; }
}
function extractJsonAfter(source, marker) {
  const at = source.indexOf(marker);
  if (at < 0) return null;
  const start = source.indexOf("{", at + marker.length);
  if (start < 0) return null;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
    } else {
      if (c === '"') inString = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(source.slice(start, i + 1)); } catch (_) { return null; }
        }
      }
    }
  }
  return null;
}
function textOf(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (x.simpleText) return x.simpleText;
  if (Array.isArray(x.runs)) return x.runs.map(function(r) { return r.text || ""; }).join("");
  return "";
}
function getPlaylistTitle(data) {
  let title = "";
  walk(data, function(n) {
    if (!title && n.playlistMetadataRenderer && n.playlistMetadataRenderer.title) title = textOf(n.playlistMetadataRenderer.title);
    if (!title && n.playlistHeaderRenderer && n.playlistHeaderRenderer.title) title = textOf(n.playlistHeaderRenderer.title);
  });
  return title;
}
function walk(node, fn) {
  if (!node || typeof node !== "object") return;
  fn(node);
  if (Array.isArray(node)) {
    for (const item of node) walk(item, fn);
  } else {
    for (const value of Object.values(node)) walk(value, fn);
  }
}
function scanPlaylist(data, items, seen) {
  let continuation = "";
  walk(data, function(n) {
    const v = n.playlistVideoRenderer;
    if (v && v.videoId && !seen.has(v.videoId)) {
      const title = textOf(v.title) || "YouTube video";
      const thumbs = v.thumbnail && Array.isArray(v.thumbnail.thumbnails) ? v.thumbnail.thumbnails : [];
      const thumb = thumbs.length ? thumbs[thumbs.length - 1].url : "https://img.youtube.com/vi/" + v.videoId + "/hqdefault.jpg";
      if (title !== "Deleted video" && title !== "Private video") {
        seen.add(v.videoId);
        items.push({
          videoId: v.videoId,
          title: title,
          description: textOf(v.descriptionSnippet) || "",
          thumbnail: thumb,
          duration: textOf(v.lengthText),
          position: items.length,
          watchUrl: "https://www.youtube.com/watch?v=" + v.videoId + "&list=" + (v.navigationEndpoint && v.navigationEndpoint.watchEndpoint && v.navigationEndpoint.watchEndpoint.playlistId || "")
        });
      }
    }
    const token = n.continuationCommand && n.continuationCommand.token;
    if (token) continuation = token;
  });
  return { continuation: continuation };
}
function scanContinuation(data) {
  let token = "";
  walk(data, function(n) {
    if (n.continuationCommand && n.continuationCommand.token) token = n.continuationCommand.token;
  });
  return token;
}
function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? String(hours) + ":" + String(minutes).padStart(2, "0") + ":" + String(remainder).padStart(2, "0")
    : String(minutes) + ":" + String(remainder).padStart(2, "0");
}
function encodeCursor(value) {
  try { return btoa(unescape(encodeURIComponent(value))).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, ""); }
  catch (_) { return ""; }
}
function decodeCursor(value) {
  if (!value) return "";
  try {
    let s = value.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const decoded = decodeURIComponent(escape(atob(s)));
    try { return JSON.parse(decoded); } catch (_) { return decoded; }
  } catch (_) { return ""; }
}
