import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

/**
 * MapLibre locates its worker with `new URL("./maplibre-gl-worker.mjs",
 * import.meta.url)`. After bundling, that resolves next to the hashed app chunk,
 * where no worker file exists, so the map silently falls back to no tiles. Copy
 * the worker into `public/` and point MapLibre at it explicitly.
 */
const require = createRequire(import.meta.url);

function copyWorker() {
  let dist;
  try {
    dist = dirname(require.resolve("maplibre-gl/package.json"));
  } catch {
    console.warn("maplibre-gl is not installed; skipping worker copy");
    return;
  }

  const source = join(dist, "dist", "maplibre-gl-worker.mjs");
  if (!existsSync(source)) {
    console.warn(`MapLibre worker not found at ${source}`);
    return;
  }

  const targetDir = join(process.cwd(), "public", "maplibre");
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(source, join(targetDir, "maplibre-gl-worker.mjs"));
  console.log("Copied MapLibre worker to public/maplibre/maplibre-gl-worker.mjs");
}

copyWorker();
