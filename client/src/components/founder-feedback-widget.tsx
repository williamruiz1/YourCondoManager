import { useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { MessageSquarePlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFounderFeedbackEligibility } from "@/hooks/use-founder-feedback-eligibility";

type Severity = "bug" | "idea" | "looks-wrong";

const SEVERITY_OPTIONS: Array<{ value: Severity; label: string }> = [
  { value: "bug", label: "Bug" },
  { value: "idea", label: "Idea" },
  { value: "looks-wrong", label: "Looks wrong" },
];

function getPortalAccessId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("portalAccessId") || "";
}

/**
 * William-only contextual feedback — portal + public surfaces (2026-07-17).
 *
 * The lightweight sibling of AdminContextualFeedbackWidget (which owns the
 * heavier "inspect an element -> create a roadmap ticket" admin flow).
 * This widget is the literal "click Feedback, type a note, submit" ask:
 * a floating button, a small panel with a free-text note + optional
 * severity, auto-captured page context, and a submit that lands in the
 * founder_feedback table + files a GitHub issue (see server/founder-feedback.ts).
 *
 * Mounted at the App root; internally gates on useFounderFeedbackEligibility
 * (server-resolved, never a client-side email check) and renders nothing
 * for anyone else. Skips rendering on admin ("/app") routes, where
 * AdminContextualFeedbackWidget already provides feedback capture — this
 * is the "don't render two floating feedback buttons on one page" guard.
 */
export function FounderFeedbackWidget() {
  const [location] = useLocation();
  const { toast } = useToast();
  const { data: eligibility } = useFounderFeedbackEligibility();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdminRoute = location === "/app" || location.startsWith("/app/");

  if (typeof document === "undefined") return null;
  if (isAdminRoute) return null;
  if (!eligibility?.eligible) return null;

  async function handleSubmit() {
    if (!note.trim()) {
      toast({
        title: "Add a note first",
        description: "Tell us what's wrong or what you'd like to see.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const portalAccessId = getPortalAccessId();
      const res = await fetch("/api/founder-feedback", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(portalAccessId ? { "x-portal-access-id": portalAccessId } : {}),
        },
        body: JSON.stringify({
          note: note.trim(),
          severity: severity || undefined,
          route: location,
          pageTitle: document.title,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `${res.status}`);
      }

      toast({
        title: "Got it — routed to the build team.",
      });
      setNote("");
      setSeverity("");
      setOpen(false);
    } catch (error) {
      toast({
        title: "Feedback submission failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return createPortal(
    <div
      data-founder-feedback-root="true"
      className="pointer-events-none fixed inset-0 z-[95]"
    >
      <div className="pointer-events-auto fixed bottom-5 right-5">
        {open ? (
          <div className="mb-3 w-[min(340px,calc(100vw-2.5rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Send feedback
            </div>
            <div className="space-y-3">
              <Textarea
                autoFocus
                rows={4}
                placeholder="What's wrong, or what would you like to see?"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    void handleSubmit();
                  }
                }}
              />
              <div className="flex flex-wrap gap-1.5">
                {SEVERITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSeverity((current) => (current === option.value ? "" : option.value))}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      severity === option.value
                        ? "border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-500 dark:bg-amber-500/20 dark:text-amber-200"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    setNote("");
                    setSeverity("");
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
                  {isSubmitting ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        <Button
          type="button"
          size="sm"
          onClick={() => setOpen((current) => !current)}
          className="h-9 gap-2 rounded-full border border-amber-300 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 px-3 text-slate-950 shadow-[0_10px_30px_rgba(249,115,22,0.35)] hover:from-amber-400 hover:via-orange-400 hover:to-rose-400"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Feedback
        </Button>
      </div>
    </div>,
    document.body,
  );
}
