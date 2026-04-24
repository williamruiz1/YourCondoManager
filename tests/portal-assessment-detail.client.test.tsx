/**
 * Wave 9 — 4.3 Q5 portal assessment detail UI test.
 *
 * Renders the `PortalAssessmentDetailBody` with a representative response
 * and asserts the nine required fields are present. Also renders the body
 * with historical (pre-Wave-6) data (missing interest + loan-style
 * fields) to confirm the "per-unit-equal / null interest" default path
 * renders without errors.
 *
 * Spec anchor:
 *   docs/projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import {
  PortalAssessmentDetailBody,
  type PortalAssessmentDetailResponse,
} from "@/components/portal-assessment-detail-dialog";

const modernPayload: PortalAssessmentDetailResponse = {
  assessment: {
    id: "assess-1",
    name: "2026 Roof Replacement",
    totalAmount: 120000,
    startDate: "2026-05-01T00:00:00.000Z",
    endDate: null,
    installmentCount: 12,
    interestRatePercent: 4.5,
    termMonths: 60,
    allocationMethod: "per-sq-ft",
    paymentOptions: {
      lumpSumAllowed: true,
      lumpSumDiscountPercent: 2.5,
      customInstallmentPlansAllowed: false,
    },
  },
  ownerPortion: {
    principal: 30000,
    interest: 3567.89,
    total: 33567.89,
    installmentAmount: 2797.32,
    remainingInstallments: 10,
    allocationReason: "per-sq-ft",
  },
  history: {
    installmentsPosted: 2,
    totalPaid: 5594.64,
    totalOwed: 27973.25,
    ledgerEntries: [
      {
        id: "entry-1",
        postedAt: "2026-05-01T00:00:00.000Z",
        amount: 2797.32,
        balance: 2797.32,
      },
      {
        id: "entry-2",
        postedAt: "2026-06-01T00:00:00.000Z",
        amount: 2797.32,
        balance: 5594.64,
      },
    ],
  },
};

const legacyPayload: PortalAssessmentDetailResponse = {
  assessment: {
    id: "assess-legacy",
    name: "Historical 2022 Assessment",
    totalAmount: 50000,
    startDate: "2022-01-01T00:00:00.000Z",
    endDate: null,
    installmentCount: 1,
    interestRatePercent: null,
    termMonths: null,
    allocationMethod: "per-unit-equal",
    paymentOptions: null,
  },
  ownerPortion: {
    principal: 2500,
    interest: 0,
    total: 2500,
    installmentAmount: 2500,
    remainingInstallments: 1,
    allocationReason: "per-unit-equal",
  },
  history: {
    installmentsPosted: 0,
    totalPaid: 0,
    totalOwed: 2500,
    ledgerEntries: [],
  },
};

describe("PortalAssessmentDetailBody — required fields", () => {
  it("renders all nine required fields (label, total principal, interest rate, term, allocation method, owner portion, payment options, total interest, history)", () => {
    render(<PortalAssessmentDetailBody data={modernPayload} />);

    // 1. Label
    expect(screen.getByTestId("field-label")).toHaveTextContent("2026 Roof Replacement");
    // 2. Total principal
    expect(screen.getByTestId("field-total-principal")).toHaveTextContent("$120000.00");
    // 3. Interest rate
    expect(screen.getByTestId("field-interest-rate")).toHaveTextContent("4.50%");
    // 4. Term
    expect(screen.getByTestId("field-term")).toHaveTextContent("60 months");
    // 5. Allocation method
    expect(screen.getByTestId("field-allocation-method")).toHaveTextContent(
      "Per square foot",
    );
    // 6. Owner portion
    expect(screen.getByTestId("field-owner-portion")).toHaveTextContent("$33567.89");
    expect(screen.getByTestId("field-owner-portion")).toHaveTextContent(
      "× 12 installments",
    );
    // 7. Payment options
    expect(screen.getByTestId("field-payment-options")).toHaveTextContent(
      /Lump-sum payoff allowed/i,
    );
    expect(screen.getByTestId("field-payment-options")).toHaveTextContent(
      /2\.50% discount/i,
    );
    // 8. Total interest
    expect(screen.getByTestId("field-total-interest")).toHaveTextContent("$3567.89");
    // 9. History
    expect(screen.getByTestId("portal-assessment-detail-history")).toBeInTheDocument();
    expect(screen.getByTestId("history-installments-posted")).toHaveTextContent("2 of 12");
    expect(screen.getByTestId("history-table")).toBeInTheDocument();
    expect(screen.getByTestId("history-row-entry-1")).toBeInTheDocument();
    expect(screen.getByTestId("history-row-entry-2")).toBeInTheDocument();
  });
});

describe("PortalAssessmentDetailBody — historical (pre-Wave-6) data", () => {
  it("renders with null interest + term + payment options without errors and defaults allocation to per-unit-equal", () => {
    render(<PortalAssessmentDetailBody data={legacyPayload} />);

    // Label + amount still render.
    expect(screen.getByTestId("field-label")).toHaveTextContent("Historical 2022 Assessment");
    expect(screen.getByTestId("field-total-principal")).toHaveTextContent("$50000.00");
    // Nullable fields render as em-dash.
    expect(screen.getByTestId("field-interest-rate")).toHaveTextContent("—");
    expect(screen.getByTestId("field-term")).toHaveTextContent("—");
    // Allocation defaults to per-unit-equal.
    expect(screen.getByTestId("field-allocation-method")).toHaveTextContent(
      "Per unit (equal split)",
    );
    // Total interest is $0.00 when interest is null.
    expect(screen.getByTestId("field-total-interest")).toHaveTextContent("$0.00");
    // Payment options fallback text.
    expect(screen.getByTestId("field-payment-options")).toHaveTextContent(
      /Installment plan only/i,
    );
    // History section renders empty state.
    expect(screen.getByTestId("history-empty")).toBeInTheDocument();
  });
});
