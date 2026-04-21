// ESLint flat config for YCM.
//
// Scope: client-side TypeScript / TSX only.
// Primary purpose (1.4 Page Title Consistency, Q6): forbid any direct
// assignment to `document.title` outside the `useDocumentTitle` hook, which
// is the SOLE permitted mechanism for setting `document.title`.
//
// The server and shared directories are intentionally unscoped — they do not
// touch `document.title`.

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
];
