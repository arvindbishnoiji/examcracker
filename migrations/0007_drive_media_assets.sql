-- Google Drive-backed site & course media assets (logos, banners, thumbnails,
-- popups, testimonials, badges, question diagrams, Open Graph images).
-- File bytes stay in Google Drive; D1 stores only metadata and serves them
-- through /api/ec/media/:id without exposing the raw Google Drive file ID.
CREATE TABLE IF NOT EXISTS drive_media_assets (
  id TEXT PRIMARY KEY NOT NULL,
  drive_file_id TEXT NOT NULL UNIQUE,
  uploader_uid TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT 'general',
  mime_type TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'deleted', 'orphan')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS drive_media_assets_status_created_idx
  ON drive_media_assets(status, created_at DESC);
