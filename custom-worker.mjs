import handler from "./.open-next/worker.js";

export default {
  async fetch(request, env, ctx) {
    // Some bundled Undici code reads process.versions.node during the first
    // request. The Workers process shim may expose process.versions without
    // the node field, even with nodejs_compat enabled. Populate it before
    // invoking the generated OpenNext handler.
    const proc = globalThis.process;
    if (proc?.versions && typeof proc.versions.node !== "string") {
      try {
        Object.defineProperty(proc.versions, "node", {
          value: "22.0.0",
          configurable: true,
          enumerable: true,
        });
      } catch {
        // Leave the original runtime error visible if the shim is immutable.
      }
    }

    return handler.fetch(request, env, ctx);
  },
};
