# Repository Guidelines

## Project Structure & Module Organization
This repository is a full-stack TypeScript app with a React/Vite frontend and an Express backend. Put UI code in `client/src`, organized by area: reusable components in `client/src/components`, route pages in `client/src/pages`, hooks in `client/src/hooks`, and shared client utilities in `client/src/lib`. Server entry and HTTP wiring live in `server/`, with database access in `server/db.ts` and route registration in `server/routes.ts`. Keep cross-stack types and Drizzle schema definitions in `shared/schema.ts`. Static assets belong in `client/public` or `attached_assets`; build output is written to `dist/` and should not be edited by hand.

## Build, Test, and Development Commands
Use `npm run dev` to start the Express app with the Vite-powered frontend in development. Run `npm run build` to produce the production bundle in `dist/`, and `npm run start` to serve that bundle. Use `npm run check` for the TypeScript type check enforced across `client/src`, `server/`, and `shared/`. Database schema changes are pushed with `npm run db:push`; this requires a valid `DATABASE_URL`.

## Coding Style & Naming Conventions
Follow the existing TypeScript style: 2-space indentation, semicolons, double quotes, and trailing commas where the formatter leaves them. Use PascalCase for React components and page modules (`DashboardPage`), camelCase for functions and variables, and kebab-case for route/page filenames such as `financial-late-fees.tsx`. Prefer the configured path aliases `@/` for client imports and `@shared/` for shared modules. The repo does not currently define ESLint or Prettier scripts, so match surrounding code closely and keep changes small and consistent.

## Testing Guidelines
There is no automated test runner configured yet. At minimum, run `npm run check` before opening a PR and manually verify the affected flow in `npm run dev`. If you add tests, place them alongside the feature as `*.test.ts` or `*.test.tsx`; the current TypeScript config excludes those files from the main build, so keep test setup isolated.

## Commit & Pull Request Guidelines
Recent history uses short, summary-style subjects such as `Add full condo property management platform features and SEO improvements`. Keep commit messages concise, imperative, and focused on one change. Pull requests should explain the user-visible impact, note any schema or environment changes, link the relevant issue, and include screenshots for UI updates.

## Configuration Tips
`DATABASE_URL` is required for local startup and Drizzle commands. Do not commit secrets, generated `dist/` assets, or local upload data from `uploads/`.
