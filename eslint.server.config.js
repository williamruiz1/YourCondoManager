// Server + shared ESLint config — CQ-001 (founder-os#10740).
//
// The primary `eslint.config.js` is client-only and explicitly ignores
// server/** + shared/**, so the 38.5k lines of money/tenant/webhook logic got
// ZERO lint analysis. This config lints them with TYPE-AWARE rules that catch
// the classes the audit called out — chiefly unawaited promises in money paths
// (`no-floating-promises`) and promises passed where a sync value is expected
// (`no-misused-promises`).
//
// Run via `npm run lint:server`. Wired into CI as a NON-BLOCKING advisory job
// (per the finding: "expect a large initial finding count — triage
// incrementally, do NOT bulk-suppress"); promote to a blocking gate once the
// initial backlog is triaged.
import tseslint from "typescript-eslint";

export default tseslint.config({
  files: ["server/**/*.ts", "shared/**/*.ts"],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  plugins: { "@typescript-eslint": tseslint.plugin },
  rules: {
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
  },
});
