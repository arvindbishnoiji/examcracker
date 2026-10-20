import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Uncomment to enable cache, KV, R2 bindings if needed
  // cloudflare: {
  //   useWorkerdCondition: true,
  // },
});
