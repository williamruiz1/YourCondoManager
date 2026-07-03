# Governing-Docs Storage — Verification Record + Persistence Runbook

**Source:** founder-os#8541 (production-readiness audit 2026-07-03, finding G-11) · closes YCM#218
**Verified:** 2026-07-03, worker-024 · **Status of flow:** WORKING end-to-end, access-controlled · **Status of persistence:** ⚠️ EPHEMERAL — see §4 (P1 filed)

## 1. The end-to-end flow (as verified)

| Step | Surface | Route | Gate |
|---|---|---|---|
| Board uploads a doc | Admin app (`client/src/pages/documents.tsx`) | `POST /api/documents` (+ `POST /api/documents/:id/versions`) | `requireAdmin` + role allowlist (platform-admin / board-officer / assisted-board / pm-assistant / manager) |
| Board uploads via owner portal (board members) | Owner portal | `POST /api/portal/board/documents` | `requirePortal` + `requireBoardAccess` (+ read-only guard) |
| Owner lists docs | Owner portal | `GET /api/portal/documents` | `requirePortal`; storage filters `associationId` = the access's community AND `isPortalVisible = 1` (board access sees all of its own community) |
| Anyone fetches the file bytes | Both | `GET /api/uploads/:filename` | `server/uploads-access.ts` (extracted 2026-07-03): admin sessions must be association-scoped to the doc; portal access must have the file in its portal-visible set; else 403 |

**Day-one document set coverage:** the upload form's `documentTypes` covers Meeting Minutes, Bylaws, Financial Report, Insurance, Legal, Maintenance, Operations, Other (`documents.tsx:58`); CC&Rs are the documented use of Legal/Other per the empty-state copy. Size limit 50 MB per file (multer). No extension allowlist on upload — mitigated at serve time (H3 below).

## 2. Access-control evidence

- **Unit matrix (27 tests):** `tests/governing-docs-access-control.test.ts` exercises the real `authorizeUploadAccess` logic: unauthenticated → 403 (file existent or not); path traversal → rejected; community-A owner sees A's portal-visible docs (direct + version fileUrls); **an owner of another community gets 403**; non-portal-visible docs invisible to same-community owners; revoked portal access → 403; admin scoped to A ✓ / scoped-only-to-B ✗ / zero-scope ✗ / inactive ✗; platform-admin ✓. Run: `npx vitest run tests/governing-docs-access-control.test.ts` → 27/27 (recorded 2026-07-03, full suite 2054/2054).
- **Live probes (2026-07-03, app.yourcondomanager.org):** unauth `GET /api/portal/documents` → 403 · unauth `GET /api/documents` → 403 · unauth `GET /api/uploads/x.pdf` → 404 pre-fix (existence leak), 403 post-fix.

## 3. Hardenings applied 2026-07-03 (founder-os#8541 PR)

| # | Gap found | Fix |
|---|---|---|
| H1 | 404-before-auth let unauthenticated callers enumerate which upload filenames exist | Authorization decided BEFORE the existence check; unauth always 403 |
| H2 | An active non-platform-admin with **zero** association scopes skipped the scope check entirely → could fetch ANY file (fail-open) | Zero scopes now denies (fail-closed) |
| H3 | Any uploaded extension served inline (`sendFile` sets Content-Type by extension) → an uploaded `.html` became same-origin stored HTML/JS | Non-inline-safe extensions (everything but pdf/png/jpg/jpeg/gif/webp/txt) now serve with `Content-Disposition: attachment` |

Logic lives in `server/uploads-access.ts`; `/api/uploads/:filename` in `server/routes.ts` is a thin shell over it.

## 4. Persistence — ⚠️ uploads are EPHEMERAL (P1)

**Mechanism (verified in code + live):** `multer.diskStorage` → `path.resolve("uploads")` = `/app/uploads` on the Fly machine's local disk. `fly.toml` has **no `[mounts]` section** and `flyctl volumes list -a yourcondomanager` returns **zero volumes** (probed 2026-07-03).

**Consequence:** every machine replacement (deploy, Fly host migration, image update) discards `/app/uploads`. DB rows in `documents` / `document_versions` survive (Neon Postgres) but point at vanished files. **Live evidence this has already happened:** `/app/uploads` on the running machine contained **0 files** on 2026-07-03 while document routes exist and `GET /api/documents/missing-files` exists precisely to detect DB-rows-without-files.

**Also breaks scale-out:** local-disk uploads are per-machine; the stopped second machine (audit R-6) would serve 404s for files uploaded on machine 1 even if a volume were added (volumes don't share across machines).

**Disposition:** P1 filed as **YCM#363** proposing:
1. **Right fix — object storage:** Fly Tigris (S3-compatible, `flyctl storage create`) or S3; multer memory/stream → bucket PUT; `/api/uploads` streams from the bucket after the same `authorizeUploadAccess` decision. Survives machine replacement AND multi-machine.
2. **Stopgap (single-machine only):** a Fly volume mounted at `/app/uploads` (`fly.toml [mounts]`) — quick, but pins uploads to one machine and conflicts with R-6's scale posture.

Until one lands: **treat uploaded governing docs as at-risk**; boards should retain originals.
