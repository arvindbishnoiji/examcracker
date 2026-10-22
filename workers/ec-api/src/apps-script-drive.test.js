import { describe, expect, it, vi } from "vitest";
import { inspectAppsScriptDriveStatus, isAppsScriptDriveConfigured, uploadViaAppsScript } from "./apps-script-drive.js";

const env = {
  GOOGLE_APPS_SCRIPT_URL: "https://script.google.com/macros/s/test-deployment/exec",
  GOOGLE_APPS_SCRIPT_SHARED_SECRET: "test-secret-never-log-0123456789abcd",
  GOOGLE_DRIVE_FOLDER_ID: "folder_123",
};

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), { status, headers });
}

describe("Apps Script personal Gmail Drive bridge", () => {
  it("requires a valid server-side URL and shared secret", () => {
    expect(isAppsScriptDriveConfigured(env)).toBe(true);
    expect(isAppsScriptDriveConfigured({ ...env, GOOGLE_APPS_SCRIPT_SHARED_SECRET: "" })).toBe(false);
    expect(isAppsScriptDriveConfigured({ ...env, GOOGLE_APPS_SCRIPT_URL: "https://example.com/exec" })).toBe(false);
    expect(isAppsScriptDriveConfigured({ ...env, GOOGLE_APPS_SCRIPT_URL: "http://script.google.com/macros/s/x/exec" })).toBe(false);
  });

  it("posts bytes as base64 with the shared secret and returns confirmed file metadata", async () => {
    const fetchImpl = vi.fn(async (_url, options) => {
      const body = JSON.parse(options.body);
      expect(body.secret).toBe("test-secret-never-log-0123456789abcd");
      expect(body.action).toBe("upload");
      expect(body.folderId).toBe("folder_123");
      expect(body.base64Data).toBe("aGVsbG8=");
      return jsonResponse({ status: "success", fileId: "drive-file-1", fileName: "photo.png", fileType: "image/png", sizeBytes: 5 });
    });
    const result = await uploadViaAppsScript(env, {
      bytes: new TextEncoder().encode("hello"),
      mimeType: "image/png",
      name: "photo.png",
      purpose: "profile_photo",
      folderId: "folder_123",
      fetchImpl,
    });
    expect(result).toEqual({ id: "drive-file-1", name: "photo.png", mimeType: "image/png", size: 5 });
  });

  it("follows ContentService response redirects only to Google-hosted response URLs", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://script.googleusercontent.com/macros/echo?user_content_key=x" } }))
      .mockResolvedValueOnce(jsonResponse({ status: "success", fileId: "f-2" }));
    const result = await uploadViaAppsScript(env, {
      bytes: new Uint8Array([1]),
      mimeType: "image/jpeg",
      name: "photo.jpg",
      purpose: "profile_photo",
      folderId: "folder_123",
      fetchImpl,
    });
    expect(result.id).toBe("f-2");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][1].method).toBe("GET");
  });

  it("rejects redirects to untrusted hosts", async () => {
    await expect(uploadViaAppsScript(env, {
      bytes: new Uint8Array([1]),
      mimeType: "image/jpeg",
      name: "photo.jpg",
      purpose: "profile_photo",
      folderId: "folder_123",
      fetchImpl: async () => new Response(null, { status: 302, headers: { location: "https://evil.example/steal" } }),
    })).rejects.toThrow("unexpected response redirect");
  });

  it("rejects Apps Script errors without reporting upload success", async () => {
    await expect(uploadViaAppsScript(env, {
      bytes: new Uint8Array([1]),
      mimeType: "image/jpeg",
      name: "photo.jpg",
      purpose: "profile_photo",
      folderId: "folder_123",
      fetchImpl: async () => jsonResponse({ status: "error", message: "Folder unavailable" }, 200),
    })).rejects.toThrow("Folder unavailable");
  });

  it("probes the folder through Apps Script without exposing the secret in status", async () => {
    const fetchImpl = vi.fn(async (_url, options) => {
      const body = JSON.parse(options.body);
      expect(body.action).toBe("status");
      expect(body.secret).toBe("test-secret-never-log-0123456789abcd");
      return jsonResponse({ status: "success", folderName: "Exam Cracker Images", canAddChildren: true });
    });
    const result = await inspectAppsScriptDriveStatus(env, "folder_123", fetchImpl);
    expect(result).toMatchObject({ ok: true, code: "READY", folderName: "Exam Cracker Images", canAddChildren: true });
    expect(JSON.stringify(result)).not.toContain("test-secret-never-log-0123456789abcd");
  });

  it("enforces the 20 MB Apps Script bridge limit", async () => {
    const fetchImpl = vi.fn();
    await expect(uploadViaAppsScript(env, {
      bytes: new Uint8Array(20 * 1024 * 1024 + 1),
      mimeType: "application/pdf",
      name: "large.pdf",
      purpose: "pdf",
      folderId: "folder_123",
      fetchImpl,
    })).rejects.toThrow("maximum 20 MB");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
