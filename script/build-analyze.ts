/**
 * Wave 33 — server bundle analyzer.
 *
 * Mirrors `script/build.ts` but emits a metafile + analysis report so we can
 * see who is contributing the most to `dist/index.cjs`. Not used in CI; this
 * is the local tool that drove Wave 33 Part B's lazy-load decisions.
 *
 * Run: `tsx script/build-analyze.ts`
 */

import { build as esbuild, analyzeMetafile } from "esbuild";
import { readFile, writeFile } from "fs/promises";

async function main() {
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  // Keep in sync with `script/build.ts`. See the comment block there for
  // the rationale behind each entry.
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
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  const result = await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.analyze.cjs",
    define: { "process.env.NODE_ENV": '"production"' },
    minify: true,
    external: [...externals, "./seed"],
    logLevel: "error",
    metafile: true,
  });

  const text = await analyzeMetafile(result.metafile, { verbose: false });
  await writeFile("dist/server-bundle-analysis.txt", text, "utf-8");
  // eslint-disable-next-line no-console
  console.log(text.slice(0, 3000));
  // eslint-disable-next-line no-console
  console.log("\nFull report: dist/server-bundle-analysis.txt");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
