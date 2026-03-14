export type FeatureStatus = "active" | "partial" | "inactive";

export type FeatureTreeRoadmapRule = {
  projectTitles: string[];
  whenMissing: FeatureStatus;
  whenInProgress: FeatureStatus;
  whenComplete: FeatureStatus;
};

export type FtphFunctionalUnitDefinition = {
  id: string;
  title: string;
  type: string;
  defaultStatus: FeatureStatus;
  notes?: string;
  roadmapRule?: FeatureTreeRoadmapRule;
};

export type FtphFeatureSetDefinition = {
  id: string;
  title: string;
  defaultStatus?: FeatureStatus;
  notes?: string;
  roadmapRule?: FeatureTreeRoadmapRule;
  functionalUnits: FtphFunctionalUnitDefinition[];
};

export type FtphModuleDefinition = {
  id: string;
  title: string;
  defaultStatus?: FeatureStatus;
  notes?: string;
  roadmapRule?: FeatureTreeRoadmapRule;
  featureSets: FtphFeatureSetDefinition[];
};

export type FtphFunctionalUnit = {
  id: string;
  title: string;
  type: string;
  status: FeatureStatus;
  userStory?: string;
  summary?: string;
  acceptanceCriteria?: string[];
  documentationNotes?: string[];
  notes?: string;
};

export type FtphFeatureSet = {
  id: string;
  title: string;
  status: FeatureStatus;
  intentSummary?: string;
  description?: string;
  userStory?: string;
  scopeBoundary?: string;
  functionalUnitSummary?: string;
  dependencies?: string[];
  risks?: string[];
  openQuestions?: string[];
  implementationNotes?: string;
  notes?: string;
  functionalUnits: FtphFunctionalUnit[];
};

export type FtphModule = {
  id: string;
  title: string;
  status: FeatureStatus;
  purpose?: string;
  notes?: string;
  featureSets: FtphFeatureSet[];
};

export type FtphFeatureTreeResponse = {
  modules: FtphModule[];
  generatedAt: string;
};

const paymentAutomationRule: FeatureTreeRoadmapRule = {
  projectTitles: ["FTPH Next Phase - Payment Processing and Financial Automation"],
  whenMissing: "inactive",
  whenInProgress: "partial",
  whenComplete: "active",
};

const propertyOperationsRule: FeatureTreeRoadmapRule = {
  projectTitles: ["FTPH Follow-On Phase - Vendor, Maintenance, and Property Operations"],
  whenMissing: "inactive",
  whenInProgress: "partial",
  whenComplete: "active",
};

const permissionsHardeningRule: FeatureTreeRoadmapRule = {
  projectTitles: [
    "Platform Gap Analysis - 2026-03-07",
    "Active Project - Google OAuth Sign-In (Session-Based)",
  ],
  whenMissing: "partial",
  whenInProgress: "partial",
  whenComplete: "active",
};

const googleOidcRule: FeatureTreeRoadmapRule = {
  projectTitles: ["Active Project - Google OAuth Sign-In (Session-Based)"],
  whenMissing: "inactive",
  whenInProgress: "partial",
  whenComplete: "active",
};

export const ftphFeatureTreeDefinition: FtphModuleDefinition[] = [
  {
    id: "1",
    title: "Unit, Owner & Occupancy Registry",
    notes: "Published registry workflows are live across units, persons, owners, and occupancy.",
    featureSets: [
      {
        id: "1.1",
        title: "Unit Registry",
        functionalUnits: [
          { id: "1.1.1", title: "Create Unit Record", type: "Data", defaultStatus: "active" },
          { id: "1.1.2", title: "Edit Unit Attributes", type: "Data", defaultStatus: "active" },
          { id: "1.1.3", title: "Track Unit Lifecycle History", type: "Logic", defaultStatus: "active" },
        ],
      },
      {
        id: "1.2",
        title: "Owner Registry",
        functionalUnits: [
          { id: "1.2.1", title: "Create Owner Profile", type: "Data", defaultStatus: "active" },
          { id: "1.2.2", title: "Link Owner to Unit", type: "Logic", defaultStatus: "active" },
          { id: "1.2.3", title: "Manage Multiple Owners", type: "Logic", defaultStatus: "active" },
        ],
      },
      {
        id: "1.3",
        title: "Tenant Contact Registry",
        functionalUnits: [
          { id: "1.3.1", title: "Submit Tenant Information Form", type: "UX", defaultStatus: "active" },
          { id: "1.3.2", title: "Store Tenant Contact Record", type: "Data", defaultStatus: "active" },
          { id: "1.3.3", title: "Track Occupancy History", type: "Logic", defaultStatus: "active" },
        ],
      },
    ],
  },
  {
    id: "2",
    title: "Governance & Board Administration",
    notes: "Board, meeting, resolution, vote, and compliance workflows are published.",
    featureSets: [
      {
        id: "2.1",
        title: "Board Member Registry",
        functionalUnits: [
          { id: "2.1.1", title: "Assign Board Member Role", type: "Logic", defaultStatus: "active" },
          { id: "2.1.2", title: "Store Board Role Metadata", type: "Data", defaultStatus: "active" },
          { id: "2.1.3", title: "Track Board Service History", type: "Logic", defaultStatus: "active" },
        ],
      },
    ],
  },
  {
    id: "3",
    title: "Financial Operations & Fee Management",
    notes: "Core finance workflows are published. Payment collection, automation, reconciliation, and reporting are still progressing through later phases.",
    featureSets: [
      {
        id: "3.1",
        title: "Fee & Assessment Engine",
        functionalUnits: [
          { id: "3.1.1", title: "Create HOA Fee Schedule", type: "Logic", defaultStatus: "active" },
          { id: "3.1.2", title: "Create Special Assessment", type: "Logic", defaultStatus: "active" },
          { id: "3.1.3", title: "Calculate Late Fees", type: "Logic", defaultStatus: "active" },
          { id: "3.1.4", title: "Track Owner Ledger Balance", type: "Data", defaultStatus: "active" },
        ],
      },
      {
        id: "3.2",
        title: "Expense & Invoice Tracking",
        functionalUnits: [
          { id: "3.2.1", title: "Record Vendor Invoice", type: "Data", defaultStatus: "active" },
          { id: "3.2.2", title: "Track Utility Payments", type: "Data", defaultStatus: "active" },
          { id: "3.2.3", title: "Store Expense Attachments", type: "Data", defaultStatus: "active" },
        ],
      },
      {
        id: "6.1",
        title: "Payment Gateway Integration",
        notes: "Documented in phases 6-10 and linked to the active payment-automation project.",
        roadmapRule: paymentAutomationRule,
        functionalUnits: [
          { id: "6.1.1", title: "Connect Payment Gateway Account", type: "Integration", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
          { id: "6.1.2", title: "Generate Owner Payment Link", type: "Logic", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
          { id: "6.1.3", title: "Record Inbound Payment Event", type: "Data", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
          { id: "6.1.4", title: "Payment Method Management", type: "UX", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
        ],
      },
      {
        id: "6.2",
        title: "Automated Payment Scheduling and Autopay",
        roadmapRule: paymentAutomationRule,
        functionalUnits: [
          { id: "6.2.1", title: "Autopay Enrollment", type: "UX", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
          { id: "6.2.2", title: "Recurring Charge Runner", type: "Logic", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
          { id: "6.2.3", title: "Autopay Event Log", type: "Data", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
          { id: "6.2.4", title: "Failed Payment Handling", type: "Logic", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
        ],
      },
      {
        id: "6.3",
        title: "Delinquency and Collections Workflow",
        roadmapRule: paymentAutomationRule,
        functionalUnits: [
          { id: "6.3.1", title: "Delinquency Threshold Rules", type: "Logic", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
          { id: "6.3.2", title: "Automated Delinquency Notice Sequence", type: "Integration", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
          { id: "6.3.3", title: "Collections Handoff Record", type: "Data", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
          { id: "6.3.4", title: "Delinquency Dashboard", type: "UX", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
        ],
      },
      {
        id: "6.4",
        title: "Bank Reconciliation Engine",
        roadmapRule: paymentAutomationRule,
        functionalUnits: [
          { id: "6.4.1", title: "Bank Transaction Import", type: "Integration", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
          { id: "6.4.2", title: "Auto-Match Engine", type: "Logic", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
          { id: "6.4.3", title: "Unmatched Transaction Review", type: "UX", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
          { id: "6.4.4", title: "Reconciliation Period Closure", type: "Logic", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
        ],
      },
      {
        id: "6.5",
        title: "Financial Reporting Suite",
        roadmapRule: paymentAutomationRule,
        functionalUnits: [
          { id: "6.5.1", title: "Income and Expense Summary Report", type: "UX", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
          { id: "6.5.2", title: "Reserve Fund Status Report", type: "Logic", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
          { id: "6.5.3", title: "Accounts Receivable Aging Report", type: "Logic", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
          { id: "6.5.4", title: "Report Export", type: "UX", defaultStatus: "inactive", roadmapRule: paymentAutomationRule },
        ],
      },
    ],
  },
  {
    id: "4",
    title: "Document & Record Management",
    notes: "Document repository and AI ingestion are published; analytics and compliance intelligence extensions remain future-state.",
    featureSets: [
      {
        id: "4.1",
        title: "Document Repository",
        functionalUnits: [
          { id: "4.1.1", title: "Upload Document", type: "UX", defaultStatus: "active" },
          { id: "4.1.2", title: "Tag Document to Entity", type: "Logic", defaultStatus: "active" },
          { id: "4.1.3", title: "Maintain Document Version History", type: "Logic", defaultStatus: "active" },
        ],
      },
      {
        id: "4.2",
        title: "AI Document Ingestion",
        functionalUnits: [
          { id: "4.2.1", title: "Upload Raw Document for Parsing", type: "UX", defaultStatus: "active" },
          { id: "4.2.2", title: "Extract Document Metadata", type: "Logic", defaultStatus: "active" },
          { id: "4.2.3", title: "Store Parsed Data", type: "Data", defaultStatus: "active" },
        ],
      },
      {
        id: "8.3",
        title: "AI Compliance Monitor",
        defaultStatus: "inactive",
        functionalUnits: [
          { id: "8.3.1", title: "Compliance Rule Extraction from Bylaws", type: "Logic", defaultStatus: "inactive" },
          { id: "8.3.2", title: "Compliance Gap Detector", type: "Logic", defaultStatus: "inactive" },
          { id: "8.3.3", title: "Compliance Alert Dashboard", type: "UX", defaultStatus: "inactive" },
          { id: "8.3.4", title: "Alert Suppression and Override", type: "Logic", defaultStatus: "inactive" },
        ],
      },
    ],
  },
  {
    id: "5",
    title: "Meetings, Notes & Decision Records",
    featureSets: [
      {
        id: "5.1",
        title: "Meeting Tracker",
        functionalUnits: [
          { id: "5.1.1", title: "Schedule Meeting Record", type: "Data", defaultStatus: "active" },
          { id: "5.1.2", title: "Record Meeting Notes", type: "Data", defaultStatus: "active" },
          { id: "5.1.3", title: "Publish Meeting Summary", type: "Logic", defaultStatus: "active" },
        ],
      },
    ],
  },
  {
    id: "6",
    title: "Operational Tasks, Compliance & Calendar",
    notes: "Core compliance tracking is published. Board reporting automation and state template expansion remain inactive future branches.",
    featureSets: [
      {
        id: "6.1",
        title: "Annual Compliance Checklist",
        functionalUnits: [
          { id: "6.1.1", title: "Create Annual Governance Tasks", type: "Logic", defaultStatus: "active" },
          { id: "6.1.2", title: "Track Task Completion", type: "Data", defaultStatus: "active" },
          { id: "6.1.3", title: "Display Compliance Dashboard", type: "UX", defaultStatus: "active" },
        ],
      },
      {
        id: "8.1",
        title: "Board Reporting Package Automation",
        defaultStatus: "inactive",
        functionalUnits: [
          { id: "8.1.1", title: "Report Package Builder", type: "Logic", defaultStatus: "inactive" },
          { id: "8.1.2", title: "Scheduled Package Generation", type: "Logic", defaultStatus: "inactive" },
          { id: "8.1.3", title: "Package Preview and Edit", type: "UX", defaultStatus: "inactive" },
          { id: "8.1.4", title: "Package Distribution via Notice", type: "Integration", defaultStatus: "inactive" },
        ],
      },
      {
        id: "8.4",
        title: "State-Specific Regulatory Compliance Templates",
        defaultStatus: "inactive",
        functionalUnits: [
          { id: "8.4.1", title: "State Template Library", type: "Data", defaultStatus: "inactive" },
          { id: "8.4.2", title: "Association-Level Template Assignment", type: "Logic", defaultStatus: "inactive" },
          { id: "8.4.3", title: "Template Versioning", type: "Logic", defaultStatus: "inactive" },
          { id: "8.4.4", title: "Custom Requirement Overlay", type: "Logic", defaultStatus: "inactive" },
        ],
      },
      {
        id: "10.6",
        title: "Regulatory Filing Automation",
        defaultStatus: "inactive",
        functionalUnits: [
          { id: "10.6.1", title: "Filing Template Library", type: "Data", defaultStatus: "inactive" },
          { id: "10.6.2", title: "Filing Pre-Population", type: "Logic", defaultStatus: "inactive" },
          { id: "10.6.3", title: "Filing Review and Approval Workflow", type: "UX", defaultStatus: "inactive" },
          { id: "10.6.4", title: "Filing Document Export", type: "UX", defaultStatus: "inactive" },
          { id: "10.6.5", title: "Filing Due Date Tracking", type: "Logic", defaultStatus: "inactive" },
        ],
      },
    ],
  },
  {
    id: "7",
    title: "Communications & Notice System",
    notes: "Current notices and communications are published. Later owner-experience communication branches remain inactive.",
    featureSets: [
      {
        id: "7.1",
        title: "Notice Automation",
        functionalUnits: [
          { id: "7.1.1", title: "Generate Notice Template", type: "Logic", defaultStatus: "active" },
          { id: "7.1.2", title: "Send Email Notice", type: "Integration", defaultStatus: "active" },
          { id: "7.1.3", title: "Log Communication History", type: "Data", defaultStatus: "active" },
        ],
      },
      {
        id: "9.5",
        title: "Community Announcements and Bulletin Board",
        defaultStatus: "inactive",
        functionalUnits: [
          { id: "9.5.1", title: "Board Announcement Publishing", type: "UX", defaultStatus: "inactive" },
          { id: "9.5.2", title: "Announcement Feed for Owners", type: "UX", defaultStatus: "inactive" },
          { id: "9.5.3", title: "Announcement Categories and Tags", type: "Data", defaultStatus: "inactive" },
          { id: "9.5.4", title: "Announcement Push Notification", type: "Integration", defaultStatus: "inactive" },
        ],
      },
    ],
  },
  {
    id: "8",
    title: "Platform Services, Permissions & Audit",
    notes: "Role and audit foundations are published; some platform identity and access-control branches remain under active hardening or future expansion.",
    featureSets: [
      {
        id: "8.1",
        title: "Role-Based Permissions",
        notes: "Authorization hardening will automatically resolve when linked roadmap projects are completed.",
        roadmapRule: permissionsHardeningRule,
        functionalUnits: [
          { id: "8.1.1", title: "Assign User Role", type: "Security", defaultStatus: "active" },
          { id: "8.1.2", title: "Restrict Data Access", type: "Security", defaultStatus: "active", roadmapRule: permissionsHardeningRule },
          { id: "8.1.3", title: "Validate Permission Changes", type: "Logic", defaultStatus: "active", roadmapRule: permissionsHardeningRule },
        ],
      },
      {
        id: "10.2",
        title: "SSO and Identity Provider Integration",
        defaultStatus: "inactive",
        notes: "Google admin sign-in is already under active delivery, while broader IdP coverage remains future-state.",
        functionalUnits: [
          { id: "10.2.1", title: "Google OAuth / OIDC Login", type: "Integration", defaultStatus: "inactive", roadmapRule: googleOidcRule },
          { id: "10.2.2", title: "Microsoft Entra ID Integration", type: "Integration", defaultStatus: "inactive" },
          { id: "10.2.3", title: "Okta and Generic SAML Support", type: "Integration", defaultStatus: "inactive" },
          { id: "10.2.4", title: "SSO-to-Role Mapping", type: "Logic", defaultStatus: "inactive" },
          { id: "10.2.5", title: "Session and Token Management", type: "Security", defaultStatus: "inactive", roadmapRule: googleOidcRule },
        ],
      },
    ],
  },
  {
    id: "9",
    title: "Operational Property Management",
    defaultStatus: "inactive",
    notes: "Added in the later documentation as a new module and tied to the follow-on property-operations project.",
    roadmapRule: propertyOperationsRule,
    featureSets: [
      {
        id: "7.1",
        title: "Vendor Registry",
        roadmapRule: propertyOperationsRule,
        functionalUnits: [
          { id: "7.1.1", title: "Create Vendor Profile", type: "Data", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
          { id: "7.1.2", title: "Link Vendor to Association", type: "Logic", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
          { id: "7.1.3", title: "Vendor Document Storage", type: "Data", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
          { id: "7.1.4", title: "Vendor Status Tracking", type: "Logic", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
        ],
      },
      {
        id: "7.2",
        title: "Work Order Management",
        roadmapRule: propertyOperationsRule,
        functionalUnits: [
          { id: "7.2.1", title: "Create Work Order", type: "Data", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
          { id: "7.2.2", title: "Work Order Lifecycle Tracking", type: "Logic", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
          { id: "7.2.3", title: "Work Order Expense Linkage", type: "Logic", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
          { id: "7.2.4", title: "Work Order History by Unit", type: "UX", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
        ],
      },
      {
        id: "7.3",
        title: "Owner and Tenant Maintenance Request Portal",
        roadmapRule: propertyOperationsRule,
        functionalUnits: [
          { id: "7.3.1", title: "Submit Maintenance Request", type: "UX", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
          { id: "7.3.2", title: "Request-to-Work-Order Conversion", type: "Logic", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
          { id: "7.3.3", title: "Request Status Notifications", type: "Integration", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
          { id: "7.3.4", title: "Request History per Submitter", type: "UX", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
        ],
      },
      {
        id: "7.4",
        title: "Preventive Maintenance Scheduling",
        roadmapRule: propertyOperationsRule,
        functionalUnits: [
          { id: "7.4.1", title: "Create Maintenance Schedule Template", type: "Logic", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
          { id: "7.4.2", title: "Schedule Instance Generation", type: "Logic", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
          { id: "7.4.3", title: "Schedule-to-Work-Order Linkage", type: "Logic", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
          { id: "7.4.4", title: "Preventive Maintenance Calendar View", type: "UX", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
        ],
      },
      {
        id: "7.5",
        title: "Property Inspection Records",
        roadmapRule: propertyOperationsRule,
        functionalUnits: [
          { id: "7.5.1", title: "Create Inspection Record", type: "Data", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
          { id: "7.5.2", title: "Inspection Finding Items", type: "Data", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
          { id: "7.5.3", title: "Inspection History per Unit", type: "UX", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
          { id: "7.5.4", title: "Inspection-to-Work-Order Linkage", type: "Logic", defaultStatus: "inactive", roadmapRule: propertyOperationsRule },
        ],
      },
    ],
  },
  {
    id: "10",
    title: "Analytics Module",
    defaultStatus: "inactive",
    notes: "Introduced in later phases for board reporting, analytics, and portfolio benchmarking.",
    featureSets: [
      {
        id: "8.2",
        title: "Financial Analytics and Trend Visualization",
        defaultStatus: "inactive",
        functionalUnits: [
          { id: "8.2.1", title: "Dues Collection Rate Chart", type: "UX", defaultStatus: "inactive" },
          { id: "8.2.2", title: "Delinquency Trend Analysis", type: "Logic", defaultStatus: "inactive" },
          { id: "8.2.3", title: "Reserve Fund Projection Model", type: "Logic", defaultStatus: "inactive" },
          { id: "8.2.4", title: "Expense Category Trend Chart", type: "UX", defaultStatus: "inactive" },
        ],
      },
      {
        id: "8.5",
        title: "Cross-Association Benchmarking",
        defaultStatus: "inactive",
        functionalUnits: [
          { id: "8.5.1", title: "Portfolio Overview Dashboard", type: "UX", defaultStatus: "inactive" },
          { id: "8.5.2", title: "Comparative Benchmarking Charts", type: "Logic", defaultStatus: "inactive" },
          { id: "8.5.3", title: "Portfolio-Level Alerts", type: "Logic", defaultStatus: "inactive" },
          { id: "8.5.4", title: "Portfolio Report Export", type: "UX", defaultStatus: "inactive" },
        ],
      },
    ],
  },
  {
    id: "11",
    title: "Owner Experience Module",
    defaultStatus: "inactive",
    notes: "Later-phase owner self-service and transactional portal capabilities.",
    featureSets: [
      {
        id: "9.1",
        title: "Owner Financial Dashboard",
        defaultStatus: "inactive",
        functionalUnits: [
          { id: "9.1.1", title: "Owner Balance Summary", type: "UX", defaultStatus: "inactive" },
          { id: "9.1.2", title: "Payment History Timeline", type: "UX", defaultStatus: "inactive" },
          { id: "9.1.3", title: "Statement Download", type: "UX", defaultStatus: "inactive" },
          { id: "9.1.4", title: "Payment Initiation from Portal", type: "Integration", defaultStatus: "inactive" },
        ],
      },
      {
        id: "9.2",
        title: "Online Voting and Ballot System",
        defaultStatus: "inactive",
        functionalUnits: [
          { id: "9.2.1", title: "Create Ballot", type: "Logic", defaultStatus: "inactive" },
          { id: "9.2.2", title: "Owner Ballot Access", type: "UX", defaultStatus: "inactive" },
          { id: "9.2.3", title: "Vote Recording", type: "Data", defaultStatus: "inactive" },
          { id: "9.2.4", title: "Ballot Result Tabulation", type: "Logic", defaultStatus: "inactive" },
          { id: "9.2.5", title: "Ballot Audit Record", type: "Data", defaultStatus: "inactive" },
        ],
      },
      {
        id: "9.3",
        title: "Amenity Booking and Reservation System",
        defaultStatus: "inactive",
        functionalUnits: [
          { id: "9.3.1", title: "Amenity Configuration", type: "Data", defaultStatus: "inactive" },
          { id: "9.3.2", title: "Availability Calendar", type: "UX", defaultStatus: "inactive" },
          { id: "9.3.3", title: "Reservation Request and Confirmation", type: "Logic", defaultStatus: "inactive" },
          { id: "9.3.4", title: "Reservation Conflict Detection", type: "Logic", defaultStatus: "inactive" },
          { id: "9.3.5", title: "Reservation Cancellation and Waitlist", type: "Logic", defaultStatus: "inactive" },
        ],
      },
      {
        id: "9.4",
        title: "E-Signature and Digital Document Execution",
        defaultStatus: "inactive",
        functionalUnits: [
          { id: "9.4.1", title: "Signature Request Creation", type: "Logic", defaultStatus: "inactive" },
          { id: "9.4.2", title: "Owner Signature UI", type: "UX", defaultStatus: "inactive" },
          { id: "9.4.3", title: "Executed Document Storage", type: "Data", defaultStatus: "inactive" },
          { id: "9.4.4", title: "Signature Audit Trail", type: "Data", defaultStatus: "inactive" },
        ],
      },
    ],
  },
  {
    id: "12",
    title: "Integration Platform",
    defaultStatus: "inactive",
    notes: "Public integrations, API platform, and ecosystem capabilities documented for later phases.",
    featureSets: [
      {
        id: "10.1",
        title: "Third-Party Integration Hub",
        defaultStatus: "inactive",
        functionalUnits: [
          { id: "10.1.1", title: "QuickBooks Online Integration", type: "Integration", defaultStatus: "inactive" },
          { id: "10.1.2", title: "Banking API Integration (Plaid)", type: "Integration", defaultStatus: "inactive" },
          { id: "10.1.3", title: "Integration Credential Vault", type: "Security", defaultStatus: "inactive" },
          { id: "10.1.4", title: "Integration Health Monitor", type: "Logic", defaultStatus: "inactive" },
          { id: "10.1.5", title: "Integration Marketplace Admin UI", type: "UX", defaultStatus: "inactive" },
        ],
      },
      {
        id: "10.3",
        title: "Public API and Developer Platform",
        defaultStatus: "inactive",
        functionalUnits: [
          { id: "10.3.1", title: "REST API v1 - Core Resources", type: "Integration", defaultStatus: "inactive" },
          { id: "10.3.2", title: "API Key Management", type: "Security", defaultStatus: "inactive" },
          { id: "10.3.3", title: "Webhook Framework", type: "Logic", defaultStatus: "inactive" },
          { id: "10.3.4", title: "Developer Documentation Portal", type: "UX", defaultStatus: "inactive" },
          { id: "10.3.5", title: "API Usage Monitoring and Rate Limiting", type: "Logic", defaultStatus: "inactive" },
        ],
      },
    ],
  },
  {
    id: "13",
    title: "Market Infrastructure",
    defaultStatus: "inactive",
    notes: "White-label, billing, reseller, and market-expansion layers documented for platform maturity.",
    featureSets: [
      {
        id: "10.4",
        title: "White-Label and Reseller Architecture",
        defaultStatus: "inactive",
        functionalUnits: [
          { id: "10.4.1", title: "Custom Domain and Branding Configuration", type: "UX", defaultStatus: "inactive" },
          { id: "10.4.2", title: "Reseller Account Hierarchy", type: "Data", defaultStatus: "inactive" },
          { id: "10.4.3", title: "Reseller Billing Pass-Through", type: "Logic", defaultStatus: "inactive" },
          { id: "10.4.4", title: "Reseller Admin Portal", type: "UX", defaultStatus: "inactive" },
          { id: "10.4.5", title: "White-Label Email Domain", type: "Integration", defaultStatus: "inactive" },
        ],
      },
      {
        id: "10.5",
        title: "Subscription Billing and Plan Management",
        defaultStatus: "inactive",
        functionalUnits: [
          { id: "10.5.1", title: "Plan Definition and Feature Flags", type: "Logic", defaultStatus: "inactive" },
          { id: "10.5.2", title: "Subscription Lifecycle Management", type: "Logic", defaultStatus: "inactive" },
          { id: "10.5.3", title: "Usage-Based Billing Meters", type: "Logic", defaultStatus: "inactive" },
          { id: "10.5.4", title: "Invoice Generation and Payment", type: "Integration", defaultStatus: "inactive" },
          { id: "10.5.5", title: "Subscription Analytics Dashboard", type: "UX", defaultStatus: "inactive" },
        ],
      },
    ],
  },
];
