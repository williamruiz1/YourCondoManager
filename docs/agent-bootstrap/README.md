# Agent Bootstrap

This folder holds generated startup context for coding agents working in this repository.

## Current Artifact
- `workspace-manifest.json`: machine-readable snapshot of routes, lazy page modules, key backend anchors, working rules, verification commands, and selected roadmap context.
- `durable-memory.json`: stable repo facts, preferred commands, verification paths, active roadmap context, and recurring known issues that should outlive any one task session.

## Refresh
Run:

```bash
npm run bootstrap:agent
```

Refresh the manifest when:
- `client/src/App.tsx` route or page imports change
- `shared/schema.ts` changes around roadmap, analysis, executive, or major domain tables
- `server/routes.ts` or `server/storage.ts` changes structurally
- `AGENTS.md` working rules change
- the roadmap backbone or active bootstrap projects change materially

## Separation Rule
- Put stable, repeatedly useful facts in `durable-memory.json`.
- Keep task-specific discoveries, debugging trails, and speculative notes out of durable memory unless they are promoted into roadmap/backbone artifacts.

## Backbone Analysis Commands
Log a friction observation:

```bash
npm run backbone:friction -- --summary="Repeated task" --category="bootstrap" --repeatable="yes" --couldPrecompute="yes"
```

Generate a bounded closeout snapshot and recommendations:

```bash
npm run backbone:closeout
```

Generate the current backbone metrics snapshot:

```bash
npm run backbone:metrics
```

Sync repeated friction patterns into bounded backbone roadmap tasks:

```bash
npm run backbone:sync-friction -- --threshold=2
```

These commands write only to backbone analysis history and do not change product behavior.
