/**
 * Template registry index (Issue founder-os#1042).
 *
 * Each entry maps a stable string key (used by `sendEmail(...)`) to its
 * template module. New templates: add the module, import it here, register
 * in `TEMPLATES`.
 */

import { welcomeBoardMemberTemplate } from "./welcome-board-member.js";
import { welcomeOwnerTemplate } from "./welcome-owner.js";
import { invoiceAssessmentTemplate } from "./invoice-assessment.js";
import { receiptPaymentTemplate } from "./receipt-payment.js";
import { passwordResetTemplate } from "./password-reset.js";
import { onboardingReminderTemplate } from "./onboarding-reminder.js";
import { communityAnnouncementTemplate } from "./community-announcement.js";

import type {
  TemplateModule,
  WelcomeBoardMemberData,
  WelcomeOwnerData,
  InvoiceAssessmentData,
  ReceiptPaymentData,
  PasswordResetData,
  OnboardingReminderData,
  CommunityAnnouncementData,
} from "./types.js";

export const TEMPLATES = {
  "welcome-board-member": welcomeBoardMemberTemplate,
  "welcome-owner": welcomeOwnerTemplate,
  "invoice-assessment": invoiceAssessmentTemplate,
  "receipt-payment": receiptPaymentTemplate,
  "password-reset": passwordResetTemplate,
  "onboarding-reminder": onboardingReminderTemplate,
  "community-announcement": communityAnnouncementTemplate,
} as const;

export type TemplateKey = keyof typeof TEMPLATES;

/**
 * Type-level mapping from template key to its `data` shape. Keeps the
 * `sendEmail({ template, data })` call site type-safe: passing
 * `template: "welcome-owner"` requires `data: WelcomeOwnerData`.
 */
export type TemplateDataMap = {
  "welcome-board-member": WelcomeBoardMemberData;
  "welcome-owner": WelcomeOwnerData;
  "invoice-assessment": InvoiceAssessmentData;
  "receipt-payment": ReceiptPaymentData;
  "password-reset": PasswordResetData;
  "onboarding-reminder": OnboardingReminderData;
  "community-announcement": CommunityAnnouncementData;
};

// Compile-time guard: every key in TEMPLATES must have a matching data type.
type _AssertCoverage = TemplateModule<TemplateDataMap[TemplateKey]>;
