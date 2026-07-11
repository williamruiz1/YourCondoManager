/**
 * Governing-docs file-serving authorization (founder-os#8541 / YCM#218).
 *
 * Extracted from the inline `/api/uploads/:filename` handler in routes.ts so
 * the access-control logic is directly unit-testable (see
 * tests/governing-docs-access-control.test.ts). Behavior preserved from the
 * original handler EXCEPT three deliberate hardenings, each flagged in the
 * founder-os#8541 PR:
 *
 *   H1 — auth-before-exists: the original returned 404 for a missing file
 *        BEFORE any auth check, letting unauthenticated callers enumerate
 *        which upload filenames exist (404 = absent, 403 = present). The
 *        authorization decision now happens first; unauthenticated callers
 *        always get 403 regardless of file existence.
 *   H2 — empty-scope fail-closed: the original skipped the association-scope
 *        check entirely when a non-platform-admin had ZERO scoped
 *        associations (`if (scopedAssociationIds.length > 0)`), serving any
 *        file to a scopeless admin account. Zero scopes now denies.
 *   H3 — inline-vs-attachment disposition: uploads accept any extension and
 *        the original served everything inline via sendFile (Content-Type by
 *        extension), so an uploaded .html became same-origin stored HTML/JS
 *        for anyone with access. Non-inline-safe extensions are now served
 *        with Content-Disposition: attachment.
 */
import path from "path";
import { isPortalAccessIdleExpired } from "./portal-expiry";

// Extensions safe to render inline in the browser. Everything else downloads.
// PDFs/images/plain text are the day-one governing-doc set (bylaws, CC&Rs,
// minutes, insurance certs) and the types owners expect to open in-tab.
export const INLINE_SAFE_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".txt",
]);

export function dispositionFor(filename: string): "inline" | "attachment" {
  const ext = path.extname(filename).toLowerCase();
  return INLINE_SAFE_EXTENSIONS.has(ext) ? "inline" : "attachment";
}

/** Filename validation — unchanged from the original handler. */
export function validateUploadFilename(
  rawFilename: string,
  uploadDir: string,
): { ok: true; filename: string; resolvedPath: string; fileUrl: string } | { ok: false; message: string } {
  const filename = path.basename(rawFilename);
  if (!filename || filename !== rawFilename || filename.startsWith(".")) {
    return { ok: false, message: "Invalid filename" };
  }
  const resolvedPath = path.resolve(path.join(uploadDir, filename));
  if (!resolvedPath.startsWith(path.resolve(uploadDir) + path.sep)) {
    return { ok: false, message: "Invalid filename" };
  }
  return { ok: true, filename, resolvedPath, fileUrl: `/api/uploads/${filename}` };
}

export interface UploadAccessInput {
  fileUrl: string;
  /** Session admin identity when `req.isAuthenticated()` — else null. */
  authUser: { adminUserId?: string | null; email?: string | null } | null;
  /** `x-portal-access-id` header value ("" when absent). */
  portalAccessId: string;
}

/** Narrow dependency surface so tests exercise the REAL logic with fakes. */
export interface UploadAccessDeps {
  getAdminUserById(id: string): Promise<{ id: string; role: string; isActive: number } | undefined>;
  getAdminUserByEmail(email: string): Promise<{ id: string; role: string; isActive: number } | undefined>;
  getAdminAssociationScopesByUserId(userId: string): Promise<Array<{ associationId: string }>>;
  /** True when a documents row with this fileUrl exists in one of the associations. */
  documentExistsInAssociations(fileUrl: string, associationIds: string[]): Promise<boolean>;
  /** True when a document_versions row with this fileUrl belongs to a document in one of the associations. */
  versionExistsInAssociations(fileUrl: string, associationIds: string[]): Promise<boolean>;
  getPortalAccessById(id: string): Promise<{ id: string; status: string; lastLoginAt?: Date | string | null } | undefined>;
  getPortalDocuments(portalAccessId: string): Promise<Array<{ id: string; fileUrl: string | null }>>;
  getDocumentVersions(documentId: string): Promise<Array<{ fileUrl: string | null }>>;
}

export type UploadAccessDecision =
  | { kind: "allow"; disposition: "inline" | "attachment" }
  | { kind: "deny"; status: 403; message: string };

export async function authorizeUploadAccess(
  input: UploadAccessInput,
  deps: UploadAccessDeps,
): Promise<UploadAccessDecision> {
  const { fileUrl, authUser, portalAccessId } = input;
  const filename = fileUrl.replace(/^\/api\/uploads\//, "");
  const allow = (): UploadAccessDecision => ({ kind: "allow", disposition: dispositionFor(filename) });

  // ── Admin-session path ────────────────────────────────────────────────────
  if (authUser) {
    const adminUser = authUser.adminUserId
      ? await deps.getAdminUserById(authUser.adminUserId)
      : authUser.email
        ? await deps.getAdminUserByEmail(authUser.email.trim().toLowerCase())
        : undefined;
    if (adminUser && adminUser.isActive === 1) {
      if (adminUser.role === "platform-admin") return allow();
      const scopedAssociationIds = (await deps.getAdminAssociationScopesByUserId(adminUser.id)).map(
        (s) => s.associationId,
      );
      // H2 — an active non-platform-admin with NO association scopes gets
      // nothing (the original fail-open served any file here).
      if (scopedAssociationIds.length === 0) {
        return { kind: "deny", status: 403, message: "File is not accessible for your association scope" };
      }
      if (await deps.documentExistsInAssociations(fileUrl, scopedAssociationIds)) return allow();
      if (await deps.versionExistsInAssociations(fileUrl, scopedAssociationIds)) return allow();
      return { kind: "deny", status: 403, message: "File is not accessible for your association scope" };
    }
    // Authenticated but not an active admin — fall through to the portal path
    // (matches the original handler).
  }

  // ── Portal path ───────────────────────────────────────────────────────────
  if (!portalAccessId) {
    return { kind: "deny", status: 403, message: "Upload access requires admin or portal credentials" };
  }
  const portalAccess = await deps.getPortalAccessById(portalAccessId);
  if (!portalAccess || portalAccess.status !== "active") {
    return { kind: "deny", status: 403, message: "Portal access required" };
  }
  // A-AUTH-005 (founder-os#10757): enforce the same 30-day idle expiry the normal portal
  // routes apply (resolvePortalAccessContext), so an active-but-idle-expired portal access
  // cannot fetch files after it is rejected everywhere else.
  if (isPortalAccessIdleExpired(portalAccess)) {
    return { kind: "deny", status: 403, message: "Portal access required" };
  }

  const portalDocs = await deps.getPortalDocuments(portalAccess.id);
  if (portalDocs.some((doc) => doc.fileUrl === fileUrl)) return allow();

  const versionLists = await Promise.all(portalDocs.map((doc) => deps.getDocumentVersions(doc.id)));
  if (versionLists.some((versions) => versions.some((v) => v.fileUrl === fileUrl))) return allow();

  return { kind: "deny", status: 403, message: "File is not visible for this portal access" };
}
