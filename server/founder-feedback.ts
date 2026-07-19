/**
 * server/founder-feedback.ts — William-only contextual feedback (2026-07-17).
 *
 * Small, self-contained module backing the founder-feedback floating button
 * that's visible on every page William visits (admin app, owner portal, and
 * public pages when he's authenticated). Two responsibilities:
 *
 *   1. The email allowlist + eligibility check. This is the ONE place the
 *      allowlist is defined — both /api/feedback/eligible and /api/feedback
 *      (the write path) call `isFounderFeedbackEmail` so the gate can never
 *      drift between the "should I show the button" check and the "should I
 *      accept this write" check. The allowlist is resolved SERVER-SIDE only;
 *      nothing here trusts a client-supplied email.
 *
 *   2. Best-effort GitHub issue filing for a submitted feedback row. If no
 *      GITHUB_TOKEN/GH_TOKEN is configured in the environment, this is a
 *      silent no-op (the founder_feedback row is still the durable record —
 *      the GM can poll the table). Filing failures never throw; the caller
 *      always gets a row written to founder_feedback regardless of whether
 *      the GitHub mirror succeeded.
 */

const FOUNDER_FEEDBACK_ALLOWED_EMAILS = new Set(
  ["chcmgmt18@gmail.com", "yourcondomanagement@gmail.com"].map((e) => e.toLowerCase()),
);

export function isFounderFeedbackEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return FOUNDER_FEEDBACK_ALLOWED_EMAILS.has(email.trim().toLowerCase());
}

const GITHUB_REPO_OWNER = "williamruiz1";
const GITHUB_REPO_NAME = "YourCondoManager";
const GITHUB_FEEDBACK_LABEL = "william-feedback";

function githubToken(): string | null {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;
}

/**
 * App version proxy — Fly.io injects FLY_IMAGE_REF into every running
 * machine (e.g. "registry.fly.io/yourcondomanager:deployment-...@sha256:...").
 * That's a zero-setup, always-accurate stand-in for a git sha without needing
 * new build-time wiring. Falls back to "unknown" outside Fly (local dev).
 */
export function resolveAppVersion(): string {
  return process.env.FLY_IMAGE_REF || process.env.npm_package_version || "unknown";
}

async function ensureFeedbackLabelExists(token: string): Promise<void> {
  try {
    await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/labels`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          name: GITHUB_FEEDBACK_LABEL,
          color: "f97316",
          description: "Direct feedback submitted by William via the in-app feedback button",
        }),
      },
    );
    // 201 = created, 422 = already exists — both are fine. Any other status
    // (permissions, rate limit) is swallowed here; issue creation below will
    // surface/skip on its own.
  } catch {
    // Best-effort only — never block issue creation on label bootstrap.
  }
}

export type FounderFeedbackGithubInput = {
  title: string;
  body: string;
};

export type FounderFeedbackGithubResult = {
  url: string;
  number: number;
} | null;

/**
 * Files a GitHub issue for a submitted feedback row. Returns null (never
 * throws) when no token is configured or the API call fails — the caller
 * always has the founder_feedback DB row as the durable fallback.
 */
export async function fileFounderFeedbackGithubIssue(
  input: FounderFeedbackGithubInput,
): Promise<FounderFeedbackGithubResult> {
  const token = githubToken();
  if (!token) return null;

  try {
    await ensureFeedbackLabelExists(token);

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          title: input.title,
          body: input.body,
          labels: [GITHUB_FEEDBACK_LABEL],
        }),
      },
    );

    if (!res.ok) return null;
    const json = (await res.json()) as { html_url?: string; number?: number };
    if (!json.html_url || typeof json.number !== "number") return null;
    return { url: json.html_url, number: json.number };
  } catch {
    return null;
  }
}

export function buildFounderFeedbackIssueTitle(note: string): string {
  const firstLine = note.trim().split("\n")[0] || note.trim();
  return `[william-feedback] ${firstLine.slice(0, 60)}`;
}

export function buildFounderFeedbackIssueBody(input: {
  note: string;
  severity: string | null;
  email: string;
  surface: string;
  route: string;
  pageTitle: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  appVersion: string;
  userAgent: string | null;
  createdAt: Date;
}): string {
  return [
    input.note.trim(),
    "",
    "---",
    "Context",
    `- from: ${input.email} (${input.surface})`,
    `- severity: ${input.severity || "unspecified"}`,
    `- route: ${input.route}`,
    `- page title: ${input.pageTitle || "unknown"}`,
    `- viewport: ${input.viewportWidth ?? "?"}x${input.viewportHeight ?? "?"}`,
    `- app version: ${input.appVersion}`,
    `- user agent: ${input.userAgent || "unknown"}`,
    `- submitted at: ${input.createdAt.toISOString()}`,
  ].join("\n");
}
