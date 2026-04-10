# Repository Guidelines

## Project Structure & Module Organization
This repository is a full-stack TypeScript app with a React/Vite frontend and an Express backend. Put UI code in `client/src`, organized by area: reusable components in `client/src/components`, route pages in `client/src/pages`, hooks in `client/src/hooks`, and shared client utilities in `client/src/lib`. Server entry and HTTP wiring live in `server/`, with database access in `server/db.ts` and route registration in `server/routes.ts`. Keep cross-stack types and Drizzle schema definitions in `shared/schema.ts`. Static assets belong in `client/public` or `attached_assets`; build output is written to `dist/` and should not be edited by hand.

## Build, Test, and Development Commands
Use `npm run dev` to start the Express app with the Vite-powered frontend in development. Run `npm run build` to produce the production bundle in `dist/`, and `npm run start` to serve that bundle. Use `npm run check` for the TypeScript type check enforced across `client/src`, `server/`, and `shared/`. Database schema changes are pushed with `npm run db:push`; this requires a valid `DATABASE_URL`.

## Agent Startup Protocol
At the start of a new coding session, agents should load the backbone artifacts before deep exploration so repeated setup work is reduced.

Default startup order:
1. Read `docs/agent-bootstrap/workspace-manifest.json`
2. Read `docs/agent-bootstrap/durable-memory.json`
3. Read `docs/projects/admin-roadmap-service-journey-backbone.md` when the task affects planning, workflows, or service structure
4. Read `docs/projects/agent-bootstrap-self-amend-guardrails.md` before using any backbone automation that writes analysis or planning artifacts

Refresh command:
- Run `npm run bootstrap:agent` after meaningful route, schema, backbone, or roadmap-context changes

Roadmap execution rule:
- When work is being done against an Admin roadmap project, agents must update the live roadmap task records in the Admin roadmap as implementation chunks are built and validated.
- Do not leave completed, validated work reflected only in code or docs; sync the corresponding roadmap task status before closeout.
- If a chunk improves a task materially but does not fully complete it, update the task to `in-progress` and leave the remaining gap explicit.
- When validated findings are discovered but no dedicated Admin roadmap project exists yet, agents must capture them in the forever-active catchall project `Admin Roadmap Catchall Findings Inbox` before closeout.
- Treat `Admin Roadmap Catchall Findings Inbox` as a permanent intake surface: add or update tasks there for verified findings, then move or mirror them into dedicated projects later if implementation planning becomes explicit. Do not mark the catchall project complete.

Backbone analysis commands:
- `npm run backbone:friction -- --summary="..." --category="..." --repeatable="yes|no" --couldPrecompute="yes|no"`
- `npm run backbone:closeout`
- `npm run backbone:metrics`
- `npm run backbone:sync-friction -- --threshold=2`

Guardrail:
- Backbone automation may update generated bootstrap artifacts, backbone docs, and backbone analysis history
- Backbone automation must not silently change product behavior, schema, authorization, or unrelated roadmap work

## Coding Style & Naming Conventions
Follow the existing TypeScript style: 2-space indentation, semicolons, double quotes, and trailing commas where the formatter leaves them. Use PascalCase for React components and page modules (`DashboardPage`), camelCase for functions and variables, and kebab-case for route/page filenames such as `financial-late-fees.tsx`. Prefer the configured path aliases `@/` for client imports and `@shared/` for shared modules. The repo does not currently define ESLint or Prettier scripts, so match surrounding code closely and keep changes small and consistent.

## Testing Guidelines
There is no automated test runner configured yet. At minimum, run `npm run check` before opening a PR and manually verify the affected flow in `npm run dev`. If you add tests, place them alongside the feature as `*.test.ts` or `*.test.tsx`; the current TypeScript config excludes those files from the main build, so keep test setup isolated.

## Commit & Pull Request Guidelines
Recent history uses short, summary-style subjects such as `Add full condo property management platform features and SEO improvements`. Keep commit messages concise, imperative, and focused on one change. Pull requests should explain the user-visible impact, note any schema or environment changes, link the relevant issue, and include screenshots for UI updates.

## Configuration Tips
`DATABASE_URL` is required for local startup and Drizzle commands. Do not commit secrets, generated `dist/` assets, or local upload data from `uploads/`.
