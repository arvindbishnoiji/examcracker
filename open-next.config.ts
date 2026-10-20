import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Prefer Workers-native package exports over Node.js fallbacks. This avoids
  // bundling Node-only code paths that can fail inside the Workers runtime.
  cloudflare: {
    useWorkerdCondition: true,
  },
});
