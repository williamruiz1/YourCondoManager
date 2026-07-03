import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls which helps cold-start.
//
// Wave 33 (5.4 Part B) — bundle-size trim:
//   - `multer` and `nodemailer` were removed from this allowlist. Both pull
//     in heavyweight transitive deps (multer → mime-db ≈ 134 KB; nodemailer
//     → its own mime-funcs/services.json ≈ 90 KB; both share `iconv-lite`'s
//     440 KB of encoding tables). Together that's roughly **750–800 KB of
//     compressed bundle** that hot-paths (auth, dashboards, the alert
//     engine) never touch. We accept the openat cost the first time a
//     handler reaches them (file uploads on /api/admin/documents, email
//     send from notification flows). Functionality is unchanged — they
//     resolve at runtime via Node's standard module resolution from
//     `node_modules/`, which is shipped alongside `dist/` in production.
//   - The eager-bundle list now reflects deps used on the boot path or on
//     every request: the express stack (`express`, `express-session`,
//     `connect-pg-simple`, `memorystore`), the auth pipeline
//     (`passport`, `passport-local`), the database driver (`pg`), and the
//     WebSocket lib used by Replit's Neon adapter (`ws`).
const allowlist = [
  "connect-pg-simple",
  "express",
  "express-session",
  "memorystore",
  "passport",
  "passport-local",
  "pg",
  "ws",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  // Wave 33 (5.4 Part B): keep heavy transitive deps that have giant data
  // tables out of the main bundle. They are still loaded eagerly at first
  // request (resolved by Node from node_modules/), so this is purely a
  // bundle-size win — no runtime change.
  //
  //   iconv-lite (~440 KB of charset tables): pulled in by express's
  //     body-parser/raw-body for non-UTF-8 request bodies. Hot-path code
  //     never trips it; bundling it duplicates the 440 KB of static
  //     encoding data needlessly.
  //   mime-db / mime-types (~150 KB JSON table): pulled in by express's
  //     `res.type()` helper. Once loaded, the JSON parses to a hash that
  //     stays in memory — same outcome whether bundled or required.
  const heavyTransitives = ["iconv-lite", "mime-db", "mime-types"];

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    // Wave 33 (5.4 Part B): mark `./seed` external so the dynamic
    // `await import("./seed.js")` in server/index.ts resolves to a
    // sibling CJS file at runtime instead of inlining ~120 KB of seed
    // data into the main bundle. We compile that sibling as a second
    // esbuild pass below.
    //
    // founder-os#2472: the runtime specifier MUST include the file
    // extension. package.json has `"type": "module"`, so `await import()`
    // invokes Node's ESM resolver, which requires explicit file extensions
    // for relative paths. The bare `./seed` specifier threw
    // ERR_MODULE_NOT_FOUND on every production boot — the seed never ran.
    //
    // Site audit 2026-06-22: the sibling was then emitted as `dist/seed.js`
    // in `format: "cjs"`. But under `"type": "module"`, Node parses a `.js`
    // file as ESM — so loading CJS-format code (with `module.exports` /
    // `require`) as ESM threw `ReferenceError: module is not defined in ES
    // module scope` on every boot ("[boot] Seed failed to run"). The fix is
    // to emit the CJS sibling with a `.cjs` extension (which forces Node's
    // CJS loader regardless of "type": "module") and import `./seed.cjs`.
    external: [...externals, ...heavyTransitives, "./seed", "./seed.js", "./seed.cjs"],
    logLevel: "info",
  });

  // Wave 33 (5.4 Part B): compile seed.ts as a sibling output. Resolved at
  // runtime by the lazy `await import("./seed")` in server/index.ts.
  //
  // We deliberately bundle the small drizzle-orm + schema graph into this
  // sibling rather than share with the main bundle. The trade-off:
  //   - seed.js is ~340 KB (its own copy of drizzle-orm + schema).
  //   - On boot, seedDatabase() opens its OWN pg.Pool (because `./db` is
  //     also bundled in here). That creates a brief dual-pool window
  //     during seeding — a few seconds at worst, then the seed pool's
  //     idle connections close after `idleTimeoutMillis: 30000`.
  // The alternative — sharing the main bundle's `./db` via an external
  // path — does not work because `./db` is itself bundled into
  // dist/index.cjs and is not a separate file at runtime. The dual-pool
  // cost is negligible for a once-per-boot seed step; the dist/index.cjs
  // size win is real (~120 KB out of the cold-start path).
  //
  // Site audit 2026-06-22: emit `.cjs`, NOT `.js`. The sibling is built in
  // `format: "cjs"` (it uses `module.exports`/`require` internally), but
  // package.json declares `"type": "module"` — so a `.js` extension makes
  // Node parse it as ESM and throw `ReferenceError: module is not defined in
  // ES module scope`. A `.cjs` extension forces the CJS loader. The boot
  // import in server/index.ts targets `./seed.cjs` to match.
  await esbuild({
    entryPoints: ["server/seed.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/seed.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: [...externals, ...heavyTransitives],
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
