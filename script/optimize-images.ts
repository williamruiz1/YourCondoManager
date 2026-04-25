#!/usr/bin/env tsx
/**
 * Static-asset optimizer for PNG/JPEG files under client/public + attached_assets.
 *
 * Wave 19 / 5.4-F4. Idempotent and re-run-safe — files already at or below the
 * compressed payload are left alone. Above-the-fold hero images are not in the
 * repo (they're served from external CDN URLs in landing.tsx and
 * community-hub-public.tsx), so the only repo asset today is favicon.png.
 *
 * Usage:
 *   tsx script/optimize-images.ts            # dry run, prints would-be savings
 *   tsx script/optimize-images.ts --write    # actually rewrite files
 *
 * Threshold: only compresses files larger than DEFAULT_THRESHOLD_BYTES.
 *
 * Implementation note: this script is intentionally lightweight and does NOT
 * pull `sharp` as a hard dependency. `sharp` ships native binaries that are
 * platform-specific (Apple Silicon vs Linux x64), and a pure devDep install
 * would inflate the lockfile by ~80 MB. Instead, the script attempts a dynamic
 * import of `sharp`; if it's not installed, it prints a manual fallback
 * (pngquant / jpegoptim) and exits 0 — the build never fails because of
 * missing optimizer binaries. To enable automated compression locally:
 *   npm i -D sharp
 * then re-run this script with --write.
 */

import { readdir, stat, readFile, writeFile } from "node:fs/promises";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(HERE, "..");

const ROOTS = [
  join(REPO_ROOT, "client", "public"),
  join(REPO_ROOT, "attached_assets"),
];

const DEFAULT_THRESHOLD_BYTES = 100 * 1024; // 100 KB
const SUPPORTED = new Set([".png", ".jpg", ".jpeg"]);

const args = new Set(process.argv.slice(2));
const WRITE = args.has("--write");

interface Candidate {
  abs: string;
  rel: string;
  size: number;
  ext: string;
}

async function walk(dir: string, out: Candidate[]) {
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // dir doesn't exist — fine
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(abs, out);
      continue;
    }
    const ext = extname(entry.name).toLowerCase();
    if (!SUPPORTED.has(ext)) continue;
    const s = await stat(abs);
    out.push({ abs, rel: relative(REPO_ROOT, abs), size: s.size, ext });
  }
}

async function loadSharp(): Promise<null | typeof import("sharp")> {
  try {
    // @ts-expect-error — optional dep, may not be installed
    const mod = await import("sharp");
    return (mod.default ?? mod) as typeof import("sharp");
  } catch {
    return null;
  }
}

async function main() {
  const candidates: Candidate[] = [];
  for (const root of ROOTS) await walk(root, candidates);

  const overThreshold = candidates.filter((c) => c.size > DEFAULT_THRESHOLD_BYTES);
  const totalBytes = candidates.reduce((sum, c) => sum + c.size, 0);

  console.log(
    `Inventory: ${candidates.length} PNG/JPEG file(s) totalling ${(totalBytes / 1024).toFixed(1)} KB`,
  );
  for (const c of candidates) {
    console.log(`  ${c.rel}  (${(c.size / 1024).toFixed(1)} KB)`);
  }

  if (overThreshold.length === 0) {
    console.log(
      `\nNo files over the ${(DEFAULT_THRESHOLD_BYTES / 1024).toFixed(0)} KB threshold. Nothing to optimize.`,
    );
    return;
  }

  console.log(
    `\n${overThreshold.length} file(s) over ${DEFAULT_THRESHOLD_BYTES / 1024} KB threshold:`,
  );
  for (const c of overThreshold) {
    console.log(`  ${c.rel}  (${(c.size / 1024).toFixed(1)} KB)`);
  }

  const sharp = await loadSharp();
  if (!sharp) {
    console.log(
      [
        "",
        "`sharp` is not installed. Skipping automated compression.",
        "Manual fallback for the files above:",
        "  PNG:  pngquant --quality=70-85 --skip-if-larger --output <file> -- <file>",
        "  JPEG: jpegoptim --max=82 --strip-all <file>",
        "",
        "To enable automated compression: npm i -D sharp && npm run optimize:images -- --write",
      ].join("\n"),
    );
    return;
  }

  let savedTotal = 0;
  for (const c of overThreshold) {
    const buf = await readFile(c.abs);
    const pipe = sharp(buf);
    const out =
      c.ext === ".png"
        ? await pipe.png({ compressionLevel: 9, palette: true, quality: 80 }).toBuffer()
        : await pipe.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    const saved = c.size - out.length;
    if (saved <= 0) {
      console.log(`  - ${c.rel}: already optimal (no rewrite)`);
      continue;
    }
    if (WRITE) {
      await writeFile(c.abs, out);
      console.log(
        `  ${c.rel}: ${(c.size / 1024).toFixed(1)} KB -> ${(out.length / 1024).toFixed(1)} KB (saved ${(saved / 1024).toFixed(1)} KB)`,
      );
    } else {
      console.log(
        `  [dry-run] ${c.rel}: would save ${(saved / 1024).toFixed(1)} KB (rerun with --write)`,
      );
    }
    savedTotal += saved;
  }
  console.log(`\nTotal savings: ${(savedTotal / 1024).toFixed(1)} KB${WRITE ? "" : " (dry run)"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
