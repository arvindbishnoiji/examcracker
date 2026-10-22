import { describe, expect, it, vi } from "vitest";
import { onRequest } from "./pages-api-entry.mjs";

function environmentWithAppsScriptOnly() {
  const workerFetch = vi.fn(async () => new Response("served by Worker", { status: 200 }));
  return {
    env: {
      GOOGLE_APPS_SCRIPT_URL: "https://script.google.com/macros/s/test-deployment/exec",
      GOOGLE_APPS_SCRIPT_SHARED_SECRET: "long-test-secret-for-pages-routing-only",
      DB: { prepare: vi.fn() },
      EXAM_CRACKER_WEB: { fetch: workerFetch },
    },
    workerFetch,
  };
}

describe("Pages API Drive runtime selection", () => {
  it("delegates private file downloads when only the Apps Script uploader is configured locally", async () => {
    const { env, workerFetch } = environmentWithAppsScriptOnly();
    const response = await onRequest({
      request: new Request("https://exam.example/api/ec/files/private-file-id"),
      env,
    });

    expect(workerFetch).toHaveBeenCalledTimes(1);
    expect(await response.text()).toBe("served by Worker");
  });

  it("delegates Drive delete and cleanup operations when the service account lives on the Worker", async () => {
    for (const [path, method] of [
      ["/api/ec/admin/drive/files/file-id", "DELETE"],
      ["/api/ec/admin/drive/cleanup", "POST"],
      ["/api/ec/admin/drive/status", "GET"],
    ]) {
      const { env, workerFetch } = environmentWithAppsScriptOnly();
      await onRequest({ request: new Request(`https://exam.example${path}`, { method }), env });
      expect(workerFetch, `${method} ${path}`).toHaveBeenCalledTimes(1);
    }
  });

  it("keeps profile-photo and PDF uploads local when Apps Script credentials are present", async () => {
    for (const [path, method] of [
      ["/api/ec/drive/profile-photo", "POST"],
      ["/api/ec/admin/drive/upload", "POST"],
    ]) {
      const { env, workerFetch } = environmentWithAppsScriptOnly();
      await onRequest({ request: new Request(`https://exam.example${path}`, { method }), env });
      expect(workerFetch, `${method} ${path}`).not.toHaveBeenCalled();
    }
  });
});
