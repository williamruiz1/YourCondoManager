// Wave 37 — onboarding checklist fixture states for Storybook.
//
// Mirrors the response shape of GET /api/onboarding/signup-checklist.
// All fields are synthetic; never reuse a real admin_users row.

export type SignupChecklistFixture = {
  associationDetailsComplete: boolean;
  boardOfficerInvited: boolean;
  unitsAdded: boolean;
  firstDocumentUploaded: boolean;
  dismissed: boolean;
  dismissedAt: string | null;
};

export const allPendingChecklist: SignupChecklistFixture = {
  associationDetailsComplete: false,
  boardOfficerInvited: false,
  unitsAdded: false,
  firstDocumentUploaded: false,
  dismissed: false,
  dismissedAt: null,
};

export const someDoneChecklist: SignupChecklistFixture = {
  associationDetailsComplete: true,
  boardOfficerInvited: true,
  unitsAdded: false,
  firstDocumentUploaded: false,
  dismissed: false,
  dismissedAt: null,
};

export const allDoneChecklist: SignupChecklistFixture = {
  associationDetailsComplete: true,
  boardOfficerInvited: true,
  unitsAdded: true,
  firstDocumentUploaded: true,
  dismissed: false,
  dismissedAt: null,
};
