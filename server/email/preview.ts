#!/usr/bin/env node
/**
 * Template preview renderer (Issue founder-os#1042).
 *
 * Renders every registered template with sample data and writes the HTML +
 * text to `docs/email-template-previews/<template>.html` (+ .txt) so
 * reviewers can open them in a real email client / browser for OP #18
 * visual fidelity verification.
 *
 * Usage:
 *   pnpm tsx server/email/preview.ts
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEMPLATES, type TemplateKey } from "./templates/index.js";

const SAMPLE = {
  "welcome-board-member": {
    recipientName: "Jane Doe",
    associationName: "Cherry Hill Court Condominiums",
    loginUrl: "https://app.yourcondomanager.org/invite/sample",
    invitedBy: "William Ruiz",
  },
  "welcome-owner": {
    recipientName: "Jane Doe",
    associationName: "Cherry Hill Court Condominiums",
    portalUrl: "https://app.yourcondomanager.org/portal/sample",
    unitLabel: "Building 1417 · Unit 3",
  },
  "invoice-assessment": {
    recipientName: "Jane Doe",
    associationName: "Cherry Hill Court Condominiums",
    unitLabel: "Building 1417 · Unit 3",
    amountFormatted: "$350.00",
    description: "May 2026 dues",
    dueDate: "2026-05-31",
    paymentLinkUrl: "https://app.yourcondomanager.org/pay/sample",
  },
  "receipt-payment": {
    recipientName: "Jane Doe",
    associationName: "Cherry Hill Court Condominiums",
    unitLabel: "Building 1417 · Unit 3",
    amountFormatted: "$350.00",
    description: "May 2026 dues",
    paidAt: "May 15, 2026",
    receiptReference: "PAY-20260515-AB12CD34",
  },
  "password-reset": {
    recipientName: "Jane Doe",
    resetUrl: "https://app.yourcondomanager.org/reset/sample",
    expiresInMinutes: 60,
  },
  "onboarding-reminder": {
    recipientName: "Jane Doe",
    dayNumber: 10,
    openSteps: ["Connect your bank", "Upload your owner roster", "Set up recurring assessments"],
    wizardUrl: "https://app.yourcondomanager.org/app/onboarding",
  },
  "community-announcement": {
    recipientName: "Jane Doe",
    communityName: "Cherry Hill Court Condominiums",
    bodyText: "We've started using YourCondoManager to handle dues, communications, and our community calendar.\n\nYou'll receive a portal invite in a separate email — click through to set your password.\n\nQuestions go to the board's email below.",
    portalUrl: "https://app.yourcondomanager.org/portal/sample",
    replyToLabel: "board@cherryhillcourt.example",
  },
} as const;

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const outDir = path.resolve(here, "../../docs/email-template-previews");
  await fs.mkdir(outDir, { recursive: true });

  for (const key of Object.keys(TEMPLATES) as TemplateKey[]) {
    const tpl = TEMPLATES[key];
    const data = SAMPLE[key];
    const html = tpl.renderHtml(data as never);
    const text = tpl.renderText(data as never);
    const subject = tpl.subject(data as never);
    const wrapped = `<!-- Subject: ${subject} -->\n${html}`;
    await fs.writeFile(path.join(outDir, `${key}.html`), wrapped, "utf8");
    await fs.writeFile(path.join(outDir, `${key}.txt`), `Subject: ${subject}\n\n${text}\n`, "utf8");
    console.log(`✓ ${key}.html + ${key}.txt`);
  }
  console.log(`Wrote previews to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
