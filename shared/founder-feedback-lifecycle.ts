export const FOUNDER_FEEDBACK_STATUSES = [
  "new",
  "triaged",
  "planned",
  "in_progress",
  "resolved",
  "dismissed",
] as const;

export type FounderFeedbackStatus = (typeof FOUNDER_FEEDBACK_STATUSES)[number];

export const allowedFounderFeedbackTransitions: Record<FounderFeedbackStatus, FounderFeedbackStatus[]> = {
  new: ["triaged", "dismissed"],
  triaged: ["new", "planned", "in_progress", "resolved", "dismissed"],
  planned: ["triaged", "in_progress", "dismissed"],
  in_progress: ["triaged", "planned", "resolved", "dismissed"],
  resolved: ["triaged", "in_progress"],
  dismissed: ["new", "triaged"],
};

export function canTransitionFounderFeedback(
  from: FounderFeedbackStatus,
  to: FounderFeedbackStatus,
): boolean {
  return from === to || allowedFounderFeedbackTransitions[from].includes(to);
}
