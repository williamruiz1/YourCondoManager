// Wave 37 — fixture data for Storybook stories that exercise the
// cross-association alert surfaces (HubAlertWidget, HomeAlertsPanel).
//
// Synthetic — never reuses production payloads. Shapes mirror the
// `AlertItem` / `CrossAssociationAlertsPayload` types exported from
// the `useCrossAssociationAlerts` hook.

import type {
  AlertItem,
  AlertSeverity,
  AlertZone,
  CrossAssociationAlertsPayload,
} from "@/hooks/useCrossAssociationAlerts";

const ASSOCIATIONS = [
  "Maple Court HOA",
  "Riverbend Towers",
  "Cedar Heights Condos",
  "Bayview Plaza",
  "Hilltop Gardens",
];

function buildAlert(
  index: number,
  zone: AlertZone,
  severity: AlertSeverity,
): AlertItem {
  const associationName = ASSOCIATIONS[index % ASSOCIATIONS.length];
  return {
    alertId: `alert-${zone}-${index}`,
    associationId: `assoc-${(index % ASSOCIATIONS.length) + 1}`,
    associationName,
    zone,
    featureDomain: zone,
    ruleType: "overdue-work-order",
    recordType: "work-order",
    recordId: `wo-${index}`,
    severity,
    title: `Sample ${severity} alert ${index + 1}`,
    description: `Synthetic ${zone} alert used by Storybook fixtures only — do not surface to real users.`,
    createdAt: new Date(2026, 3, 24 - (index % 14)).toISOString(),
    resolutionHref: `/app/${zone}`,
    sourceRecord: { id: `wo-${index}` },
  };
}

export function buildAlertList(
  count: number,
  zone: AlertZone = "financials",
): AlertItem[] {
  const severities: AlertSeverity[] = ["critical", "high", "medium", "low"];
  return Array.from({ length: count }, (_, i) =>
    buildAlert(i, zone, severities[i % severities.length]),
  );
}

export function buildPayload(
  alerts: AlertItem[],
): CrossAssociationAlertsPayload {
  return {
    alerts,
    readStateBy: Object.fromEntries(
      alerts.map((a) => [a.alertId, { readAt: null, dismissedAt: null }]),
    ),
  };
}

export const fewFinancialsAlerts = buildAlertList(2, "financials");
export const manyFinancialsAlerts = buildAlertList(12, "financials");
export const homeAlerts = [
  ...buildAlertList(2, "financials"),
  ...buildAlertList(2, "operations"),
  ...buildAlertList(1, "governance"),
  ...buildAlertList(1, "communications"),
];
