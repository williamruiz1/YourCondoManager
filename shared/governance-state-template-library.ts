export type GovernanceStateTemplateSeed = {
  stateCode: string;
  name: string;
  versionNumber: number;
  sourceAuthority: string;
  sourceUrl: string;
  sourceDocumentTitle: string;
  sourceDocumentDate: string;
  effectiveDate: string;
  verificationCadenceDays: number;
  items: Array<{
    title: string;
    description: string;
    legalReference: string;
    sourceCitation: string;
    sourceUrl: string;
    dueMonth: number;
    dueDay: number;
    orderIndex: number;
  }>;
};

export const governanceStateTemplateLibrary: GovernanceStateTemplateSeed[] = [
  {
    stateCode: "CT",
    name: "Connecticut Annual Compliance Checklist",
    versionNumber: 1,
    sourceAuthority: "Connecticut General Assembly / Secretary of the State",
    sourceUrl: "https://portal.ct.gov/sots/business-services/annual-report-page",
    sourceDocumentTitle: "Connecticut Secretary of the State Annual Report Guidance",
    sourceDocumentDate: "2026-03-15",
    effectiveDate: "2026-01-01",
    verificationCadenceDays: 90,
    items: [
      { title: "File annual report with the Secretary of the State", description: "Confirm the association's annual filing is submitted and principal officer records are current.", legalReference: "Secretary of the State annual report filing", sourceCitation: "Connecticut Secretary of the State annual report guidance", sourceUrl: "https://portal.ct.gov/sots/business-services/annual-report-page", dueMonth: 3, dueDay: 31, orderIndex: 1 },
      { title: "Adopt annual budget and common charge schedule", description: "Document board approval of the annual budget and resulting common charges.", legalReference: "Conn. Gen. Stat. Sec. 47-261e", sourceCitation: "Common interest community budget adoption duties", sourceUrl: "https://www.cga.ct.gov/current/pub/chap_828.htm", dueMonth: 12, dueDay: 15, orderIndex: 2 },
      { title: "Prepare annual unit owner meeting", description: "Set meeting notice, agenda, and board election materials for the annual owner meeting.", legalReference: "Conn. Gen. Stat. Sec. 47-250", sourceCitation: "Association meetings and notice requirements", sourceUrl: "https://www.cga.ct.gov/current/pub/chap_828.htm", dueMonth: 5, dueDay: 1, orderIndex: 3 },
      { title: "Review reserve funding plan", description: "Review reserve balances, projected capital needs, and any recommended contribution changes.", legalReference: "Conn. Gen. Stat. Sec. 47-257", sourceCitation: "Association responsibility for common elements and reserves", sourceUrl: "https://www.cga.ct.gov/current/pub/chap_828.htm", dueMonth: 10, dueDay: 15, orderIndex: 4 },
    ],
  },
  {
    stateCode: "FL",
    name: "Florida Annual Compliance Checklist",
    versionNumber: 1,
    sourceAuthority: "Florida Legislature",
    sourceUrl: "https://www.leg.state.fl.us/statutes/",
    sourceDocumentTitle: "Florida Condominium Act",
    sourceDocumentDate: "2026-03-15",
    effectiveDate: "2026-01-01",
    verificationCadenceDays: 90,
    items: [
      { title: "Complete annual financial reporting package", description: "Prepare the annual financial report at the compilation, review, or audit level required for the association.", legalReference: "Fla. Stat. 718.111(13)", sourceCitation: "Annual financial reporting requirements", sourceUrl: "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0700-0799/0718/Sections/0718.111.html", dueMonth: 4, dueDay: 30, orderIndex: 1 },
      { title: "Distribute annual meeting and election notice", description: "Issue the first and second annual meeting notices and election materials within the required lead times.", legalReference: "Fla. Stat. 718.112(2)(d)", sourceCitation: "Annual meeting and election notice requirements", sourceUrl: "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0700-0799/0718/Sections/0718.112.html", dueMonth: 1, dueDay: 15, orderIndex: 2 },
      { title: "Review reserve disclosures and funding elections", description: "Confirm reserve accounts, waiver votes, and disclosure language are current for the budget cycle.", legalReference: "Fla. Stat. 718.112(2)(f)", sourceCitation: "Budget and reserve disclosure requirements", sourceUrl: "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0700-0799/0718/Sections/0718.112.html", dueMonth: 11, dueDay: 15, orderIndex: 3 },
      { title: "Certify board member education or records acknowledgment", description: "Track annual director education certificates or written acknowledgments required under current law.", legalReference: "Fla. Stat. 718.112(2)(d)4", sourceCitation: "Director education or certification duties", sourceUrl: "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0700-0799/0718/Sections/0718.112.html", dueMonth: 6, dueDay: 30, orderIndex: 4 },
    ],
  },
  {
    stateCode: "CA",
    name: "California Annual Compliance Checklist",
    versionNumber: 1,
    sourceAuthority: "California Legislature",
    sourceUrl: "https://leginfo.legislature.ca.gov/",
    sourceDocumentTitle: "California Davis-Stirling Act reporting requirements",
    sourceDocumentDate: "2026-03-15",
    effectiveDate: "2026-01-01",
    verificationCadenceDays: 90,
    items: [
      { title: "Deliver annual budget report package", description: "Distribute the annual budget report with reserve summary, funding disclosures, and policy statements.", legalReference: "Cal. Civ. Code Sec. 5300", sourceCitation: "Annual budget report package", sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=5300.&lawCode=CIV", dueMonth: 11, dueDay: 30, orderIndex: 1 },
      { title: "Issue annual policy statement", description: "Confirm the annual policy statement is updated and delivered with current governance and assessment policies.", legalReference: "Cal. Civ. Code Sec. 5310", sourceCitation: "Annual policy statement requirements", sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=5310.&lawCode=CIV", dueMonth: 11, dueDay: 30, orderIndex: 2 },
      { title: "Run annual meeting and director election", description: "Prepare inspector, ballot, and notice workflow for the annual meeting and election cycle.", legalReference: "Cal. Civ. Code Sec. 5100-5145", sourceCitation: "Election operating rules and annual meeting procedures", sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=4.&chapter=6.&lawCode=CIV&title=6.", dueMonth: 6, dueDay: 1, orderIndex: 3 },
      { title: "Review reserve study disclosures", description: "Review reserve study timing, deferred maintenance inputs, and annual reserve disclosure content.", legalReference: "Cal. Civ. Code Sec. 5550", sourceCitation: "Reserve study review requirements", sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=5550.&lawCode=CIV", dueMonth: 9, dueDay: 30, orderIndex: 4 },
    ],
  },
];
