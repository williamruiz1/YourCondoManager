/**
 * server/founder-feedback.ts — William-only contextual feedback (2026-07-17).
 *
 * Small, self-contained module backing the founder-feedback floating button
 * that's visible on every page William visits (admin app, owner portal, and
 * public pages when he's authenticated). Two responsibilities:
 *
 *   1. The email allowlist + eligibility check. This is the ONE place the
 *      allowlist is defined — both /api/founder-feedback/eligible and
 *      /api/founder-feedback
 *      (the write path) call `isFounderFeedbackEmail` so the gate can never
 *      drift between the "should I show the button" check and the "should I
 *      accept this write" check. The allowlist is resolved SERVER-SIDE only;
 *      nothing here trusts a client-supplied email.
 *
 *   2. Idempotent GitHub issue delivery with explicit result state. The only
 *      accepted credential is the restricted YCM_FEEDBACK_GITHUB_TOKEN Fly
 *      secret. Failures never expose the token or provider response body.
 */

import { createHash } from "node:crypto";

const FOUNDER_FEEDBACK_ALLOWED_EMAILS = new Set(
  ["chcmgmt18@gmail.com", "yourcondomanagement@gmail.com"].map((e) => e.toLowerCase()),
);

export function isFounderFeedbackEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return FOUNDER_FEEDBACK_ALLOWED_EMAILS.has(email.trim().toLowerCase());
}

/**
 * Route context is useful; query strings and fragments are not. Strip them
 * before persistence, logging, or GitHub mirroring so magic-link tokens and
 * other sensitive URL parameters can never leave the browser via feedback.
 */
export function sanitizeFounderFeedbackRoute(route: string): string {
  return route.split(/[?#]/, 1)[0] || "/";
}

const GITHUB_REPO_OWNER = "williamruiz1";
const GITHUB_REPO_NAME = "YourCondoManager";
const GITHUB_FEEDBACK_LABEL = "william-feedback";

function githubToken(): string | null {
  return process.env.YCM_FEEDBACK_GITHUB_TOKEN || null;
}

const SECRET_PATTERNS: RegExp[] = [
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*\b/gi,
  /\b((?:api[_-]?key|token|secret|password|authorization)\s*[:=]\s*)[^\s,;]+/gi,
  /([?&](?:token|code|secret|key|signature|access_token)=)[^&#\s]+/gi,
];

export function redactFounderFeedbackText(value: string | null | undefined): string | null {
  if (value == null) return null;
  let redacted = value;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, (_match, prefix?: string) => `${prefix || ""}[REDACTED]`);
  }
  return redacted;
}

export function buildFounderFeedbackDedupeKey(input: {
  email: string;
  route: string;
  severity: string | null;
  note: string;
  createdAt: Date;
}): string {
  const tenMinuteBucket = Math.floor(input.createdAt.getTime() / 600_000);
  const normalized = [
    input.email.trim().toLowerCase(),
    sanitizeFounderFeedbackRoute(input.route),
    input.severity || "unspecified",
    input.note.trim().replace(/\s+/g, " ").toLowerCase(),
    tenMinuteBucket,
  ].join("\n");
  return createHash("sha256").update(normalized).digest("hex");
}

export function founderFeedbackIssueMarker(feedbackId: string): string {
  return `<!-- ycm-founder-feedback-id:${feedbackId} -->`;
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

export type FounderFeedbackGithubResult =
  | { status: "delivered"; url: string; number: number; reused: boolean }
  | { status: "unavailable"; error: "token-not-configured" }
  | { status: "failed"; error: string };

async function findFounderFeedbackGithubIssue(
  token: string,
  marker: string,
  label = GITHUB_FEEDBACK_LABEL,
): Promise<{ url: string; number: number } | null> {
  for (let page = 1; page <= 10; page += 1) {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/issues?state=all&labels=${encodeURIComponent(label)}&per_page=100&page=${page}`,
      { headers: githubHeaders(token) },
    );
    if (!res.ok) return null;
    const issues = (await res.json()) as Array<{ body?: string; html_url?: string; number?: number }>;
    const found = issues.find((issue) => issue.body?.includes(marker));
    if (found?.html_url && typeof found.number === "number") {
      return { url: found.html_url, number: found.number };
    }
    if (issues.length < 100) break;
  }
  return null;
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * Files a GitHub issue for a submitted feedback row. Returns null (never
 * throws) when no token is configured or the API call fails — the caller
 * always has the founder_feedback DB row as the durable fallback.
 */
export async function fileFounderFeedbackGithubIssue(
  input: FounderFeedbackGithubInput,
  marker: string,
): Promise<FounderFeedbackGithubResult> {
  const token = githubToken();
  if (!token) return { status: "unavailable", error: "token-not-configured" };

  try {
    await ensureFeedbackLabelExists(token);

    const existing = await findFounderFeedbackGithubIssue(token, marker);
    if (existing) return { status: "delivered", ...existing, reused: true };

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/issues`,
      {
        method: "POST",
        headers: githubHeaders(token),
        body: JSON.stringify({
          title: input.title,
          body: `${input.body}\n\n${marker}`,
          labels: [GITHUB_FEEDBACK_LABEL],
        }),
      },
    );

    if (!res.ok) return { status: "failed", error: `github-http-${res.status}` };
    const json = (await res.json()) as { html_url?: string; number?: number };
    if (!json.html_url || typeof json.number !== "number") {
      return { status: "failed", error: "github-invalid-response" };
    }
    return { status: "delivered", url: json.html_url, number: json.number, reused: false };
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown";
    return { status: "failed", error: `github-request-${name}` };
  }
}

export async function cleanupSyntheticFounderFeedbackIssues(): Promise<{
  status: "completed" | "unavailable" | "failed";
  closed: number;
  error?: string;
}> {
  const token = githubToken();
  if (!token) return { status: "unavailable", closed: 0, error: "token-not-configured" };
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/issues?state=open&labels=william-feedback-synthetic&per_page=100`,
      { headers: githubHeaders(token) },
    );
    if (!res.ok) return { status: "failed", closed: 0, error: `github-http-${res.status}` };
    const issues = (await res.json()) as Array<{ number?: number }>;
    let closed = 0;
    for (const issue of issues) {
      if (typeof issue.number !== "number") continue;
      const close = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/issues/${issue.number}`,
        { method: "PATCH", headers: githubHeaders(token), body: JSON.stringify({ state: "closed" }) },
      );
      if (close.ok) closed += 1;
    }
    return { status: "completed", closed };
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown";
    return { status: "failed", closed: 0, error: `github-request-${name}` };
  }
}

export function buildFounderFeedbackIssueTitle(note: string): string {
  const safeNote = redactFounderFeedbackText(note) || "feedback";
  const firstLine = safeNote.trim().split("\n")[0] || safeNote.trim();
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
    (redactFounderFeedbackText(input.note) || "").trim(),
    "",
    "---",
    "Context",
    `- from: allowlisted founder account (${input.surface})`,
    `- severity: ${input.severity || "unspecified"}`,
    `- route: ${input.route}`,
    `- page title: ${redactFounderFeedbackText(input.pageTitle) || "unknown"}`,
    `- viewport: ${input.viewportWidth ?? "?"}x${input.viewportHeight ?? "?"}`,
    `- app version: ${input.appVersion}`,
    `- user agent: ${redactFounderFeedbackText(input.userAgent) || "unknown"}`,
    `- submitted at: ${input.createdAt.toISOString()}`,
  ].join("\n");
}
