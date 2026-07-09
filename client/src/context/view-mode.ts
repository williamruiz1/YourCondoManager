// founder-os#9487 — Board mode / Manager mode view state.
//
// YCM has two kinds of operator: a trained property manager (CAM) and a
// volunteer HOA board member with zero PM training and no jargon tolerance.
// "Mode" is a per-user UI preference — separate from the backend `AdminRole` —
// that reskins the SAME backend:
//
//   - "board"   → simplified nav, plain-English labels, guided wizards.
//   - "manager" → the full technical workspace (unchanged).
//
// The advanced-view toggle lets a Board-mode user temporarily reveal the full
// technical nav + labels without leaving Board mode.
//
// Implementation mirrors `use-user-settings.ts`: a tiny external store backed by
// localStorage keyed per admin id, exposed via `useSyncExternalStore`. This
// makes it reactive everywhere and available before any React context mounts.

import { useSyncExternalStore } from "react";
import type { AdminRole } from "@shared/schema";

export type ViewMode = "board" | "manager";

export type ViewModeState = {
  /** The chosen skin. */
  mode: ViewMode;
  /** Board mode only — reveal the full technical nav + labels this session. */
  advancedView: boolean;
  /** Whether the user has explicitly picked a mode (drives the signup selector). */
  modeChosen: boolean;
};

const STORAGE_KEY_PREFIX = "board-view-mode-";
const ADMIN_ID_KEY = "user-settings-admin-id"; // reuse the same admin-id anchor as user-settings

const DEFAULT_STATE: ViewModeState = {
  mode: "manager",
  advancedView: false,
  modeChosen: false,
};

let listeners: Array<() => void> = [];
let cachedSnapshot: ViewModeState = load();

function getStorageKey(): string {
  try {
    const raw = localStorage.getItem(ADMIN_ID_KEY);
    if (raw) return STORAGE_KEY_PREFIX + raw;
  } catch {}
  return STORAGE_KEY_PREFIX + "default";
}

function load(): ViewModeState {
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ViewModeState>;
      return {
        mode: parsed.mode === "board" || parsed.mode === "manager" ? parsed.mode : DEFAULT_STATE.mode,
        advancedView: Boolean(parsed.advancedView),
        modeChosen: Boolean(parsed.modeChosen),
      };
    }
  } catch {}
  return { ...DEFAULT_STATE };
}

function persist(state: ViewModeState) {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(state));
  } catch {}
}

function notify() {
  cachedSnapshot = load();
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): ViewModeState {
  return cachedSnapshot;
}

/** Called once auth resolves so the store reads/writes under the real admin key. */
export function setViewModeAdminId(adminId: string) {
  try {
    localStorage.setItem(ADMIN_ID_KEY, adminId);
  } catch {}
  notify();
}

/** Default mode for a role (used only until the user explicitly chooses). */
export function defaultModeForRole(role: AdminRole | null | undefined): ViewMode {
  return role === "board-officer" || role === "assisted-board" ? "board" : "manager";
}

/**
 * Seed the default mode from the admin role WITHOUT marking it as chosen — so a
 * board member lands in Board mode by default, but the signup selector still
 * appears until they confirm/switch. No-op once a mode has been chosen.
 */
export function seedDefaultModeFromRole(role: AdminRole | null | undefined) {
  const current = load();
  if (current.modeChosen) return;
  const next: ViewModeState = { ...current, mode: defaultModeForRole(role) };
  persist(next);
  notify();
}

/** Explicit user choice (signup selector or settings) — persists + marks chosen. */
export function chooseMode(mode: ViewMode) {
  const current = load();
  persist({ ...current, mode, modeChosen: true, advancedView: false });
  notify();
}

/** Switch mode without re-opening the selector (dual-role users toggling). */
export function setMode(mode: ViewMode) {
  const current = load();
  persist({ ...current, mode, modeChosen: true });
  notify();
}

/** Board-mode advanced-view toggle (reveal full nav + technical labels). */
export function setAdvancedView(advancedView: boolean) {
  const current = load();
  persist({ ...current, advancedView });
  notify();
}

export function useViewMode(): ViewModeState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Non-reactive read of the current state (for tests / imperative callers). */
export function getViewModeSnapshot(): ViewModeState {
  return cachedSnapshot;
}

/**
 * True when the user should see the simplified, plain-English Board surface —
 * Board mode AND advanced view is off. This is the single predicate that drives
 * the board sidebar, plain-English labels, and the wizard-first home.
 */
export function useIsBoardSurface(): boolean {
  const { mode, advancedView } = useViewMode();
  return mode === "board" && !advancedView;
}

export { DEFAULT_STATE as DEFAULT_VIEW_MODE_STATE };
