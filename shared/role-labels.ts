/**
 * Canonical display labels for admin and portal role strings.
 * Use this map wherever a role value is rendered to a user —
 * UI badges, email templates, dropdowns, audit displays.
 *
 * "board-admin" is a legacy alias; display as "Assisted Board" if encountered
 * in historical data. New code should never emit "board-admin".
 */
export const roleDisplayLabels: Record<string, string> = {
  'manager': 'Manager',
  'pm-assistant': 'PM Assistant',
  'board-officer': 'Board Officer',
  'assisted-board': 'Assisted Board',
  'viewer': 'Viewer',
  'platform-admin': 'Platform Admin',
  'owner': 'Owner',
  // Legacy alias — only present in historical audit/log data
  'board-admin': 'Assisted Board (legacy)',
};
