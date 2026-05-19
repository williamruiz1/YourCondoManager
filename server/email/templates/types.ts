/**
 * Template registry types — per Issue founder-os#1042.
 *
 * Each template module exports:
 *   - `key`        — unique identifier matching the dispatch's named list
 *   - `subject(data)` — function returning the email subject
 *   - `renderHtml(data)` — full HTML body (with YCM v1 brand styling)
 *   - `renderText(data)` — plain-text fallback (per Resend best practice;
 *                          improves deliverability + DMARC compliance)
 *
 * Data shape is per-template; the wrapper `sendEmail(...)` is a TS-generic
 * indexer over the registry.
 */

export type TemplateModule<TData> = {
  readonly key: string;
  subject(data: TData): string;
  renderHtml(data: TData): string;
  renderText(data: TData): string;
};

// ── Per-template data shapes ──────────────────────────────────────────────

export type WelcomeBoardMemberData = {
  recipientName: string;
  associationName: string;
  loginUrl: string;
  invitedBy: string;
};

export type WelcomeOwnerData = {
  recipientName: string;
  associationName: string;
  portalUrl: string;
  unitLabel: string;
};

export type InvoiceAssessmentData = {
  recipientName: string;
  associationName: string;
  unitLabel: string;
  amountFormatted: string; // e.g., "$350.00"
  description: string;     // e.g., "May 2026 dues" or "2026 Q2 assessment"
  dueDate: string;         // e.g., "2026-05-31"
  paymentLinkUrl: string;
};

export type ReceiptPaymentData = {
  recipientName: string;
  associationName: string;
  unitLabel: string;
  amountFormatted: string;
  description: string;
  paidAt: string;          // human-readable, e.g., "May 15, 2026"
  receiptReference: string; // e.g., "PAY-20260515-AB12CD34"
};

export type PasswordResetData = {
  recipientName: string;
  resetUrl: string;
  expiresInMinutes: number; // e.g., 60
};

// #1617 — onboarding wizard reminder cadence.
export type OnboardingReminderData = {
  recipientName: string;
  /** 7 | 10 | 12 | 13 | 14 — drives the tone block selection. */
  dayNumber: number;
  /** Plain-English labels of the wizard steps still open (e.g., ["Connect your bank", "Upload your owner roster"]). */
  openSteps: string[];
  /** Deep-link back to /app/onboarding. */
  wizardUrl: string;
};

// #1617 — wizard Step 5 community-wide announcement.
export type CommunityAnnouncementData = {
  /** May be null when sending a no-personalization batch fallback. */
  recipientName: string | null;
  communityName: string;
  /** Plain-text message authored by the board; rendered as paragraphs (no HTML pass-through). */
  bodyText: string;
  /** Override the default subject; falsy = use the template default. */
  subjectOverride?: string;
  /** Deep-link to the owner portal. */
  portalUrl: string;
  /** Displayed as the reply-to address in the plain-text footer. */
  replyToLabel: string;
};
