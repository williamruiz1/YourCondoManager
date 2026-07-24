# Governing-docs flow — end-to-end verification (YCM#218 / founder-os#8541)

Recorded probes, 2026-07-03 (worker-015). Every claim below cites the live code path or a
live infrastructure probe run this day — nothing is inferred.

## Verdict summary

| Concern | State | Evidence |
|---|---|---|
| Board upload works (types/sizes) | ✅ works; 50MB cap; ANY file type accepted | `server/routes.ts:355-364` (multer diskStorage, `fileSize: 50MB`, no fileFilter) |
| Owner-portal visibility | ✅ scoped | `/api/portal/documents` (routes.ts:13720) → `getPortalDocuments` (storage.ts:14365): association-scoped; owners see ONLY `isPortalVisible=1`; board access sees all of ITS association |
| Cross-community isolation (owner of another community gets nothing) | ✅ enforced at BOTH list and file layers | list: `getPortalDocuments` filters `documents.associationId = access.associationId`; file: `/api/uploads/:filename` portal branch (routes.ts:3700-3717) 403s unless the file is in THAT access's portal docs or their versions |
| Admin file access | ✅ scoped | `/api/uploads/:filename` admin branch (routes.ts:3661-3693): non-platform-admin must have the doc's association in their scoped associations (documents + documentVersions checked) else 403 |
| Path traversal | ✅ double-guarded | routes.ts:3641-3653 — basename-only + resolved-path-inside-uploadDir check |
| Board self-serve upload from the portal | ✅ exists | `POST /api/portal/board/documents` (routes.ts:14772) behind `requirePortal + requireBoardAccess + requireBoardAccessReadOnly` |
| **Uploads persistence** | 🔴 **EPHEMERAL — P1** | see below |

## 🔴 P1 — uploads are ephemeral on Fly (documents WILL be lost)

Probes (2026-07-03):

1. Storage backend is **local disk**: `server/routes.ts:350` — `const uploadDir = path.resolve("uploads")`,
   multer `diskStorage` writes there; served back from the same dir.
2. `fly.toml` (app `yourcondomanager`) has **no `[mounts]` section** — the `uploads/` dir lives on
   the machine's root filesystem.
3. `flyctl volumes list -a yourcondomanager` → **empty** (zero volumes exist).
4. Root filesystems on Fly machines are rebuilt from the image on every deploy / machine
   replacement → **every uploaded governing document uploaded since the last deploy is destroyed
   by the next deploy.**
5. Corroborating in-repo evidence that this loss class already happens:
   `GET /api/documents/missing-files` (routes.ts:3221) exists specifically to list documents whose
   DB row survives but whose file is gone from disk.

Filed as a P1 with proposed fix (Tigris object storage, or a Fly volume + `[mounts]` as the
single-machine stopgap): see the issue linked from this PR.

## Notes / accepted-as-is

- No upload `fileFilter` (any extension accepted, 50MB cap). Acceptable for a board-only,
  authed upload surface; revisit if uploads ever open to owners.
- Owner "tenant" portal role no longer exists (Phase 8a note in storage.ts) — resident-audience
  splits would key on memberships, not portal role.
