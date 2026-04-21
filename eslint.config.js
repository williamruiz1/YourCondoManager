// ESLint flat config for YCM.
//
// Scope: client-side TypeScript / TSX only.
// Purposes:
//   - 1.4 Page Title Consistency, Q6: forbid any direct assignment to
//     `document.title` outside the `useDocumentTitle` hook, which is the
//     SOLE permitted mechanism for setting `document.title`.
//   - 1.2 Section Hub Reclassification, Q7: forbid "Hub" / "Overview"
//     suffixes in sidebar nav-label strings (zone-label-only naming).
//     Scoped narrowly to `app-sidebar.tsx` so tab-label "Overview" uses
//     (dashboard sub-page surfaces per 1.2 contract §4) are not swept in.
//     See docs/projects/platform-overhaul/implementation-artifacts/
//     1.2-hub-contract.md §8.
//
// The server and shared directories are intentionally unscoped — they do not
// touch `document.title` and do not host nav labels.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    // Global ignores.
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "migrations/**",
      "export/**",
      "uploads/**",
      "attached_assets/**",
      "scripts/**",
      "script/**",
      "server/**",
      "shared/**",
      "tests/**",
      "*.config.js",
      "*.config.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["client/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
      },
    },
    rules: {
      // --- 1.4 Q6: useDocumentTitle is the SOLE mechanism setting document.title. ---
      // Flag direct assignments: `document.title = ...`, including compound
      // forms like `document.title += ...`. The hook file itself writes
      // document.title once and is exempted via an inline eslint-disable-next-line.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "AssignmentExpression[left.type='MemberExpression'][left.object.name='document'][left.property.name='title']",
          message:
            "Direct `document.title = ...` is forbidden. Use the `useDocumentTitle` hook from @/hooks/useDocumentTitle (1.4 Q6: sole title-setter).",
        },
      ],

      // Keep the baseline quiet so the title rule stands alone as the primary
      // signal. These off-switches are scoped to client code only.
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/triple-slash-reference": "off",
      "no-empty": "off",
      "no-empty-pattern": "off",
      "no-useless-escape": "off",
      "no-prototype-builtins": "off",
      "no-case-declarations": "off",
      "no-constant-condition": "off",
      "no-async-promise-executor": "off",
      "no-control-regex": "off",
      "no-fallthrough": "off",
      "no-misleading-character-class": "off",
      "no-self-assign": "off",
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-redeclare": "off",
      "no-cond-assign": "off",
      "no-func-assign": "off",
      "no-unsafe-optional-chaining": "off",
      "no-extra-boolean-cast": "off",
      "no-unused-expressions": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    // --- 1.2 Q7: Zone-label-only naming for sidebar nav labels. ---
    // Forbid "Hub" / "Overview" as suffixes in `{ title: "..." }` and
    // `{ label: "..." }` object-property strings that define sidebar
    // navigation entries.
    //
    // Scope is deliberately narrow: `app-sidebar.tsx` is the single source
    // of truth for zone-root navigation today (per `/home/runner/workspace/
    // docs/projects/platform-overhaul/decisions/1.2-section-hub-
    // reclassification.md` Q4 / §7 of the 1.2 hub contract). Tab labels
    // (`finance-tab-bar.tsx`, `association-context.tsx`, `board-portal.tsx`,
    // `owner-portal.tsx`) legitimately use "Overview" for dashboard sub-page
    // tabs per 1.2 contract §4 and are intentionally excluded from this
    // rule via the narrow `files:` glob.
    //
    // Allowed exceptions require an inline `eslint-disable-next-line
    // no-restricted-syntax` at the offending literal, with a comment
    // citing the decision ID that authorizes the exception (e.g., 0.1 AC 7
    // for "Operations Overview").
    files: [
      "client/src/components/app-sidebar.tsx",
      // Room to grow into future sidebar/nav config modules without
      // dragging tab-bar or page-level code into the rule.
      "client/src/components/nav-*.{ts,tsx}",
      "client/src/lib/nav-*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        // Preserve the 1.4 Q6 document.title rule verbatim so this scoped
        // block does not silently narrow it away for the sidebar file.
        {
          selector:
            "AssignmentExpression[left.type='MemberExpression'][left.object.name='document'][left.property.name='title']",
          message:
            "Direct `document.title = ...` is forbidden. Use the `useDocumentTitle` hook from @/hooks/useDocumentTitle (1.4 Q6: sole title-setter).",
        },
        // 1.2 Q7 — no "Hub" suffix in nav `{ title: "..." }` literals.
        {
          selector:
            "Property[key.name='title'][value.type='Literal'][value.value=/ Hub$/]",
          message:
            "Nav labels must use the zone label alone. 'Hub' is forbidden as a suffix in sidebar `title` strings (1.2 Q7). See docs/projects/platform-overhaul/implementation-artifacts/1.2-hub-contract.md §4.",
        },
        // 1.2 Q7 — no "Hub" suffix in nav `{ label: "..." }` literals.
        {
          selector:
            "Property[key.name='label'][value.type='Literal'][value.value=/ Hub$/]",
          message:
            "Nav labels must use the zone label alone. 'Hub' is forbidden as a suffix in sidebar `label` strings (1.2 Q7). See docs/projects/platform-overhaul/implementation-artifacts/1.2-hub-contract.md §4.",
        },
        // 1.2 Q7 — no "Overview" suffix in nav `{ title: "..." }` literals.
        // Exception: `{ title: "Operations Overview" }` at the Operations
        // sidebar entry is locked by 0.1 AC 7 and must be suppressed with
        // an inline `eslint-disable-next-line no-restricted-syntax` at
        // that literal.
        {
          selector:
            "Property[key.name='title'][value.type='Literal'][value.value=/ Overview$/]",
          message:
            "Nav labels must use the zone label alone. 'Overview' is forbidden as a suffix in sidebar `title` strings (1.2 Q7). The single allowed exception is 'Operations Overview' at `/app/operations/dashboard` (0.1 AC 7), which requires an inline `eslint-disable-next-line no-restricted-syntax` comment with a decision-ID citation.",
        },
        // 1.2 Q7 — no "Overview" suffix in nav `{ label: "..." }` literals.
        {
          selector:
            "Property[key.name='label'][value.type='Literal'][value.value=/ Overview$/]",
          message:
            "Nav labels must use the zone label alone. 'Overview' is forbidden as a suffix in sidebar `label` strings (1.2 Q7). See docs/projects/platform-overhaul/implementation-artifacts/1.2-hub-contract.md §4.",
        },
      ],
    },
  },
];
