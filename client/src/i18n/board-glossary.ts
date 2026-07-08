// founder-os#9487 — Board mode plain-English glossary.
//
// Board mode assumes zero CAM training and no jargon tolerance (research #833
// [472] §6, §7.2). This glossary maps the platform's technical / accounting
// vocabulary to the plain English a volunteer board member actually uses. It
// backs the Board-mode nav, home, and wizards; when the advanced-view toggle is
// on, surfaces fall back to the technical term (see `plainLabel`).
//
// The map is the single source of truth for Board-mode wording — add a row here
// rather than hardcoding plain strings in components, so the plain/technical
// switch stays consistent and testable.

export const BOARD_GLOSSARY: Record<string, string> = {
  // Money
  "AR Aging": "Money owed by owners",
  "Accounts Receivable": "Money owed by owners",
  "Delinquency": "Owners who are behind",
  "Assessment": "Owner charge",
  "Special Assessment": "One-time charge to everyone",
  "Owner Ledger": "Owner's account history",
  "Ledger Entry": "Charge or payment",
  "Charge": "Bill an owner",
  "Late Fee": "Late penalty",
  "Chart of Accounts": "Money categories",
  "General Ledger": "Full money record",
  "Reconciliation": "Match the bank",
  "Disbursement": "Pay a bill",
  "AP": "Bills to pay",
  "Accounts Payable": "Bills to pay",
  "Budget": "Spending plan",
  "Lien": "Legal claim for unpaid dues",
  // People & units
  "Persons": "Owners & residents",
  "Ownerships": "Who owns which unit",
  "Occupancy": "Who lives where",
  "Units": "Homes",
  "Resident": "Neighbor",
  // Governance
  "Governance": "Board & rules",
  "Governance Meeting": "Board meeting",
  "Elections": "Voting",
  "Ballot": "Vote",
  "Compliance": "Rule-following",
  "Violation": "Rule broken",
  "Board Package": "Meeting packet",
  // Operations
  "Work Order": "Repair job",
  "Vendor": "Contractor",
  "Maintenance Schedule": "Upkeep plan",
  "Inspection": "Property check",
  "Resident Feedback": "Neighbor notes",
  // Comms
  "Announcements": "Notices to owners",
  "Communications": "Messages",
  // Misc
  "Association": "Community",
};

/**
 * Return the plain-English label for a technical term when on the Board surface,
 * otherwise the technical term unchanged. Unknown terms pass through as-is.
 *
 * @param term          the canonical / technical label
 * @param isBoardSurface true = Board mode with advanced view OFF (plain English)
 */
export function plainLabel(term: string, isBoardSurface: boolean): string {
  if (!isBoardSurface) return term;
  return BOARD_GLOSSARY[term] ?? term;
}
