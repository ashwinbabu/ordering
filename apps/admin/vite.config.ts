import vinext from "vinext";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import hostingConfig from "../../.openai/hosting.json";
import { sites } from "../../build/sites-vite-plugin";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

const { r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

// Use Nitro when building for Vercel.
// VERCEL=1 is provided by Vercel CI.
// NITRO_PRESET=vercel lets us test the same build locally.
const isVercel =
  process.env.VERCEL === "1" || process.env.NITRO_PRESET === "vercel";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= resolve(repositoryRoot, ".wrangler/logs");
  process.env.MINIFLARE_REGISTRY_PATH ??= resolve(
    repositoryRoot,
    ".wrangler/registry",
  );

  if (isVercel) {
    const { nitro } = await import("nitro/vite");
    const { default: tailwindcss } = await import("@tailwindcss/vite");

    return {
      server: {
        host: "0.0.0.0",
        allowedHosts: ["terminal.local"],
        ...(isCodexSeatbeltSandbox
          ? { watch: { useFsEvents: false, usePolling: true } }
          : {}),
      },
      plugins: [tailwindcss(), vinext(), sites(repositoryRoot), nitro()],
    };
  }

  // Local/Codex development continues to use the existing Cloudflare setup.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(repositoryRoot),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
