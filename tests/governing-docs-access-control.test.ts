/**
 * Governing-docs access control (founder-os#8541 / YCM#218).
 *
 * Exercises the REAL authorization logic in server/uploads-access.ts (not a
 * copy) with faked storage deps. Scenario matrix from the dispatch:
 *
 *   1. Unauthenticated caller gets nothing (403) — whether or not the file
 *      exists (H1: no filename enumeration via 404-before-auth).
 *   2. Path traversal / dotfile filenames rejected.
 *   3. Board/portal member of community A can view A's portal-visible docs
 *      (direct fileUrl + version fileUrl).
 *   4. An owner of ANOTHER community gets nothing (403) for A's files.
 *   5. Portal access that is inactive gets nothing.
 *   6. Non-portal-visible docs are invisible to owner portal access.
 *   7. Admin scoped to community A can fetch A's file; an admin scoped only
 *      to community B cannot fetch A's file.
 *   8. H2: an active non-platform-admin with ZERO association scopes is
 *      denied (the pre-#8541 handler failed OPEN here).
 *   9. platform-admin sees everything.
 *  10. H3: inline-safe extensions serve inline; anything else (e.g. .html)
 *      is forced to attachment so uploads can't become same-origin stored
 *      HTML/JS.
 */
import path from "path";
import { describe, it, expect } from "vitest";
import {
  authorizeUploadAccess,
  validateUploadFilename,
  dispositionFor,
  type UploadAccessDeps,
} from "../server/uploads-access";

const FILE_A = "/api/uploads/1000-bylaws-a.pdf"; // community A, portal-visible, direct
const FILE_A_V2 = "/api/uploads/1001-bylaws-a-v2.pdf"; // community A, lives on a version row
const FILE_A_HIDDEN = "/api/uploads/1002-draft-minutes-a.pdf"; // community A, NOT portal-visible
const FILE_B = "/api/uploads/2000-ccrs-b.pdf"; // community B

function makeDeps(): UploadAccessDeps {
  // Community A: portal access "portal-a" (active, owner) sees doc-a (direct)
  // and doc-a2 (via version). doc-a-hidden is not portal-visible. Community B:
  // portal access "portal-b" sees doc-b only.
  const portalDocs: Record<string, Array<{ id: string; fileUrl: string | null }>> = {
    "portal-a": [
      { id: "doc-a", fileUrl: FILE_A },
      { id: "doc-a2", fileUrl: "/api/uploads/old-current.pdf" },
    ],
    "portal-b": [{ id: "doc-b", fileUrl: FILE_B }],
    // A-AUTH-005 — idle vs fresh portal access both "see" doc-a; only the
    // idle-expired one should be denied by the shared expiry check.
    "portal-idle": [{ id: "doc-a", fileUrl: FILE_A }],
    "portal-fresh": [{ id: "doc-a", fileUrl: FILE_A }],
  };
  const versions: Record<string, Array<{ fileUrl: string | null }>> = {
    "doc-a": [],
    "doc-a2": [{ fileUrl: FILE_A_V2 }],
    "doc-b": [],
  };
  const admins: Record<string, { id: string; role: string; isActive: number }> = {
    "admin-platform": { id: "admin-platform", role: "platform-admin", isActive: 1 },
    "admin-a": { id: "admin-a", role: "board-officer", isActive: 1 },
    "admin-b": { id: "admin-b", role: "board-officer", isActive: 1 },
    "admin-noscope": { id: "admin-noscope", role: "manager", isActive: 1 },
    "admin-inactive": { id: "admin-inactive", role: "board-officer", isActive: 0 },
  };
  const scopes: Record<string, string[]> = {
    "admin-a": ["assoc-a"],
    "admin-b": ["assoc-b"],
    "admin-noscope": [],
  };
  // Which fileUrls belong to which association (documents + version rows).
  const docFiles: Record<string, string> = {
    [FILE_A]: "assoc-a",
    [FILE_A_HIDDEN]: "assoc-a",
    [FILE_B]: "assoc-b",
  };
  const versionFiles: Record<string, string> = { [FILE_A_V2]: "assoc-a" };

  return {
    getAdminUserById: async (id) => admins[id],
    getAdminUserByEmail: async () => undefined,
    getAdminAssociationScopesByUserId: async (userId) =>
      (scopes[userId] ?? []).map((associationId) => ({ associationId })),
    documentExistsInAssociations: async (fileUrl, associationIds) =>
      fileUrl in docFiles && associationIds.includes(docFiles[fileUrl]!),
    versionExistsInAssociations: async (fileUrl, associationIds) =>
      fileUrl in versionFiles && associationIds.includes(versionFiles[fileUrl]!),
    getPortalAccessById: async (id) =>
      id === "portal-a" || id === "portal-b"
        ? { id, status: "active" }
        : id === "portal-revoked"
          ? { id, status: "revoked" }
          : id === "portal-idle"
            ? { id, status: "active", lastLoginAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000) }
            : id === "portal-fresh"
              ? { id, status: "active", lastLoginAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) }
              : undefined,
    getPortalDocuments: async (portalAccessId) => portalDocs[portalAccessId] ?? [],
    getDocumentVersions: async (documentId) => versions[documentId] ?? [],
  };
}

const noAuth = { authUser: null, portalAccessId: "" };

describe("filename validation", () => {
  const dir = path.resolve("uploads");
  it("accepts a plain filename", () => {
    const r = validateUploadFilename("1000-bylaws-a.pdf", dir);
    expect(r.ok).toBe(true);
  });
  it.each(["../secrets.env", "a/../../etc/passwd", ".hidden", ""])(
    "rejects %j",
    (bad) => {
      expect(validateUploadFilename(bad, dir).ok).toBe(false);
    },
  );
});

describe("unauthenticated callers", () => {
  it("gets 403 with no credentials — even for a file that exists (no enumeration)", async () => {
    const d = await authorizeUploadAccess({ fileUrl: FILE_A, ...noAuth }, makeDeps());
    expect(d).toMatchObject({ kind: "deny", status: 403 });
  });
  it("gets 403 for a nonexistent file too (indistinguishable)", async () => {
    const d = await authorizeUploadAccess(
      { fileUrl: "/api/uploads/no-such-file.pdf", ...noAuth },
      makeDeps(),
    );
    expect(d).toMatchObject({ kind: "deny", status: 403 });
  });
});

describe("owner portal access (community scoping)", () => {
  it("community A owner views A's portal-visible doc (direct fileUrl)", async () => {
    const d = await authorizeUploadAccess(
      { fileUrl: FILE_A, authUser: null, portalAccessId: "portal-a" },
      makeDeps(),
    );
    expect(d).toMatchObject({ kind: "allow", disposition: "inline" });
  });
  it("community A owner views A's doc via a VERSION fileUrl", async () => {
    const d = await authorizeUploadAccess(
      { fileUrl: FILE_A_V2, authUser: null, portalAccessId: "portal-a" },
      makeDeps(),
    );
    expect(d).toMatchObject({ kind: "allow" });
  });
  it("an owner of ANOTHER community gets nothing for A's file", async () => {
    const d = await authorizeUploadAccess(
      { fileUrl: FILE_A, authUser: null, portalAccessId: "portal-b" },
      makeDeps(),
    );
    expect(d).toMatchObject({ kind: "deny", status: 403 });
  });
  it("non-portal-visible docs are invisible to portal access of the SAME community", async () => {
    const d = await authorizeUploadAccess(
      { fileUrl: FILE_A_HIDDEN, authUser: null, portalAccessId: "portal-a" },
      makeDeps(),
    );
    expect(d).toMatchObject({ kind: "deny", status: 403 });
  });
  it("revoked portal access gets nothing", async () => {
    const d = await authorizeUploadAccess(
      { fileUrl: FILE_A, authUser: null, portalAccessId: "portal-revoked" },
      makeDeps(),
    );
    expect(d).toMatchObject({ kind: "deny", status: 403, message: "Portal access required" });
  });

  // A-AUTH-005 — the file surface now enforces the same 30-day idle-session
  // expiry as every other portal route (resolvePortalAccessContext).
  it("an idle-expired (active but >30d) portal access is DENIED file access", async () => {
    const d = await authorizeUploadAccess(
      { fileUrl: FILE_A, authUser: null, portalAccessId: "portal-idle" },
      makeDeps(),
    );
    expect(d).toMatchObject({ kind: "deny", status: 403, message: "Portal access required" });
  });

  it("a fresh (recently-active) portal access still fetches its visible doc", async () => {
    const d = await authorizeUploadAccess(
      { fileUrl: FILE_A, authUser: null, portalAccessId: "portal-fresh" },
      makeDeps(),
    );
    expect(d).toMatchObject({ kind: "allow" });
  });
});

describe("admin sessions (association scoping)", () => {
  it("admin scoped to A fetches A's file", async () => {
    const d = await authorizeUploadAccess(
      { fileUrl: FILE_A, authUser: { adminUserId: "admin-a" }, portalAccessId: "" },
      makeDeps(),
    );
    expect(d).toMatchObject({ kind: "allow" });
  });
  it("admin scoped to A fetches A's version-row file", async () => {
    const d = await authorizeUploadAccess(
      { fileUrl: FILE_A_V2, authUser: { adminUserId: "admin-a" }, portalAccessId: "" },
      makeDeps(),
    );
    expect(d).toMatchObject({ kind: "allow" });
  });
  it("admin scoped ONLY to B cannot fetch A's file", async () => {
    const d = await authorizeUploadAccess(
      { fileUrl: FILE_A, authUser: { adminUserId: "admin-b" }, portalAccessId: "" },
      makeDeps(),
    );
    expect(d).toMatchObject({ kind: "deny", status: 403 });
  });
  it("H2: active admin with ZERO scoped associations is DENIED (pre-#8541 failed open)", async () => {
    const d = await authorizeUploadAccess(
      { fileUrl: FILE_A, authUser: { adminUserId: "admin-noscope" }, portalAccessId: "" },
      makeDeps(),
    );
    expect(d).toMatchObject({ kind: "deny", status: 403 });
  });
  it("inactive admin falls through to portal path; with no portal header → 403", async () => {
    const d = await authorizeUploadAccess(
      { fileUrl: FILE_A, authUser: { adminUserId: "admin-inactive" }, portalAccessId: "" },
      makeDeps(),
    );
    expect(d).toMatchObject({ kind: "deny", status: 403 });
  });
  it("platform-admin fetches anything", async () => {
    for (const f of [FILE_A, FILE_B, FILE_A_HIDDEN]) {
      const d = await authorizeUploadAccess(
        { fileUrl: f, authUser: { adminUserId: "admin-platform" }, portalAccessId: "" },
        makeDeps(),
      );
      expect(d).toMatchObject({ kind: "allow" });
    }
  });
});

describe("H3: inline vs attachment disposition", () => {
  it.each(["bylaws.pdf", "site-plan.png", "minutes.txt"])("%s serves inline", (f) => {
    expect(dispositionFor(f)).toBe("inline");
  });
  it.each(["evil.html", "macro.docm", "notes.svg", "archive.zip", "minutes.docx"])(
    "%s downloads as attachment",
    (f) => {
      expect(dispositionFor(f)).toBe("attachment");
    },
  );
  it("allow decisions carry the disposition (html file → attachment)", async () => {
    const deps = makeDeps();
    const htmlUrl = "/api/uploads/9-page.html";
    // platform-admin path so authorization passes and we observe disposition
    (deps as any).documentExistsInAssociations = async () => true;
    const d = await authorizeUploadAccess(
      { fileUrl: htmlUrl, authUser: { adminUserId: "admin-platform" }, portalAccessId: "" },
      deps,
    );
    expect(d).toMatchObject({ kind: "allow", disposition: "attachment" });
  });
});
