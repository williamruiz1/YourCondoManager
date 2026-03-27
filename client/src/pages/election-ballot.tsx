import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Vote, CheckCircle2, Lock, AlertTriangle, Clock, ArrowRight } from "lucide-react";

type BallotStep = "review" | "select" | "confirm";

function StepProgress({ current }: { current: BallotStep }) {
  const steps = [
    { key: "review" as const, label: "Review" },
    { key: "select" as const, label: "Select" },
    { key: "confirm" as const, label: "Confirm" },
  ];
  const currentIndex = steps.findIndex(s => s.key === current);
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
            i <= currentIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>
            {i + 1}
          </div>
          <span className={`text-xs ${i <= currentIndex ? "text-foreground font-medium" : "text-muted-foreground"}`}>
            {step.label}
          </span>
          {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < currentIndex ? "bg-primary" : "bg-muted"}`} />}
        </div>
      ))}
    </div>
  );
}

type BallotData = {
  election: {
    id: string;
    title: string;
    description: string | null;
    voteType: string;
    isSecretBallot: number;
    closesAt: string | null;
    status: string;
    maxChoices: number | null;
  };
  options: Array<{ id: string; label: string; description: string | null }>;
  ballotToken: { id: string; status: string; electionId: string };
};

function voteTypeLabel(t: string) {
  return (
    {
      "board-election": "Board Election",
      resolution: "Resolution",
      "community-referendum": "Community Referendum",
      "amendment-ratification": "Amendment Ratification",
    }[t] ?? t
  );
}

/** Format remaining time as a human-readable string */
function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "0 minutes";
  const totalMinutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export default function ElectionBallotPage({ token }: { token: string }) {
  const { toast } = useToast();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [confirmationRef, setConfirmationRef] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [ballotStep, setBallotStep] = useState<BallotStep>("review");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Deadline countdown state
  const [now, setNow] = useState(() => Date.now());
  const [votingExpired, setVotingExpired] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const { data, isLoading, error } = useQuery<BallotData>({
    queryKey: ["/api/elections/ballot", token],
    queryFn: () => apiRequest("GET", `/api/elections/ballot/${token}`).then((r) => r.json()),
  });

  const castMutation = useMutation({
    mutationFn: (choices: string[]) =>
      apiRequest("POST", `/api/elections/ballot/${token}/cast`, { choices }).then((r) => r.json()),
    onSuccess: (result) => {
      setSubmitted(true);
      setConfirmationRef(result.confirmationRef);
      setShowConfirm(false);
    },
    onError: (err: Error) => {
      setShowConfirm(false);
      toast({ title: "Vote failed", description: err.message, variant: "destructive" });
    },
  });

  // Compute deadline info
  const closesAt = data?.election?.closesAt ? new Date(data.election.closesAt).getTime() : null;
  const msRemaining = closesAt ? closesAt - now : null;

  useEffect(() => {
    if (msRemaining !== null && msRemaining <= 0) {
      setVotingExpired(true);
    }
  }, [msRemaining]);

  const toggleOption = useCallback(
    (optionId: string) => {
      setBallotStep("select");
      setSelectedOptions((prev) => {
        if (prev.includes(optionId)) return prev.filter((id) => id !== optionId);
        const mc = data?.election?.maxChoices;
        if (mc && prev.length >= mc) return prev;
        return [...prev, optionId];
      });
    },
    [data?.election?.maxChoices],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number, optionsLength: number) => {
      let nextIndex = -1;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        nextIndex = (index + 1) % optionsLength;
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        nextIndex = (index - 1 + optionsLength) % optionsLength;
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggleOption(data?.options[index]?.id ?? "");
        return;
      }
      if (nextIndex >= 0) {
        setFocusedIndex(nextIndex);
        optionRefs.current[nextIndex]?.focus();
      }
    },
    [data?.options, toggleOption],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-sm text-muted-foreground">Loading ballot...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center">
            <Lock className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
            <div className="font-medium mb-1">Invalid or expired ballot link</div>
            <div className="text-sm text-muted-foreground">This ballot link is not valid. Please contact your association for assistance.</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { election, options, ballotToken } = data;

  const alreadyCast = ballotToken.status === "cast" || ballotToken.status === "consumed-by-proxy" || ballotToken.status === "revoked";

  if (submitted && confirmationRef) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <div className="text-xl font-semibold">Vote Recorded</div>
            <div className="text-sm text-muted-foreground">
              Your vote for <strong>{election.title}</strong> has been recorded.
            </div>
            {election.isSecretBallot ? (
              <div className="text-xs text-muted-foreground bg-muted rounded px-3 py-2">
                This is a secret ballot — your specific choice is not included in this receipt.
              </div>
            ) : null}
            <div className="rounded-lg border bg-muted/50 px-4 py-3 font-mono text-sm text-center">
              <div className="text-xs text-muted-foreground mb-1">Confirmation Reference</div>
              <div className="font-bold tracking-wider">{confirmationRef}</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Keep this reference number for your records.
            </div>
            <a href="/portal" className="inline-flex items-center gap-1 text-primary hover:underline text-sm mt-2">
              View your voting history in the Owner Portal
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (alreadyCast) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-3">
            <CheckCircle2 className="mx-auto h-10 w-10 text-blue-500" />
            <div className="font-medium">Vote Already Recorded</div>
            <div className="text-sm text-muted-foreground">
              {ballotToken.status === "consumed-by-proxy"
                ? "A proxy has been designated to vote on your behalf for this election."
                : "Your vote has already been cast for this election."}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if voting has expired client-side
  if (votingExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-3">
            <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
            <div className="font-medium">Voting has closed</div>
            <div className="text-sm text-muted-foreground">
              The deadline for this election has passed. No more votes can be accepted.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (election.status !== "open") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-3">
            <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
            <div className="font-medium">Voting {election.status === "closed" || election.status === "certified" ? "Closed" : "Not Yet Open"}</div>
            <div className="text-sm text-muted-foreground">
              {election.status === "draft" && "This election has not opened for voting yet."}
              {(election.status === "closed" || election.status === "certified") && "This election has closed. No more votes can be accepted."}
              {election.status === "cancelled" && "This election has been cancelled."}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const maxChoices = election.maxChoices;
  const isMultiChoice = maxChoices ? maxChoices > 1 : options.length > 2;
  const atMaxChoices = maxChoices ? selectedOptions.length >= maxChoices : false;

  // Build selection instruction text
  const selectionInstruction = maxChoices === null || maxChoices === undefined
    ? (options.length > 2 ? "Select one or more options" : "Select one option")
    : maxChoices === 1
      ? "Select one option"
      : `Select up to ${maxChoices} options`;

  // Deadline banner
  const showDeadlineBanner = msRemaining !== null && msRemaining > 0 && msRemaining <= 24 * 60 * 60_000;
  const deadlineUrgent = msRemaining !== null && msRemaining > 0 && msRemaining <= 60 * 60_000;

  // Determine ARIA role for the options group
  const groupRole = isMultiChoice ? "group" : "radiogroup";
  const optionRole = isMultiChoice ? "checkbox" : "radio";

  // Selected labels for confirmation dialog
  const selectedLabels = options
    .filter((o) => selectedOptions.includes(o.id))
    .map((o) => o.label);

  return (
    <div className="min-h-screen bg-muted/30 flex items-start justify-center p-4 pt-12 pb-24 sm:pb-4">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center mb-6">
          <Vote className="mx-auto h-8 w-8 text-primary mb-2" />
          <h1 className="text-xl font-bold">{election.title}</h1>
          <div className="text-sm text-muted-foreground mt-1">{voteTypeLabel(election.voteType)}</div>
          {election.closesAt && (
            <div className="text-xs text-muted-foreground mt-1">
              Voting closes {new Date(election.closesAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* Step progress indicator */}
        <StepProgress current={ballotStep} />

        {/* 6.4: Deadline countdown banner */}
        {showDeadlineBanner && (
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
              deadlineUrgent
                ? "border-red-300 bg-red-50 text-red-800"
                : "border-yellow-300 bg-yellow-50 text-yellow-800"
            }`}
            role="alert"
          >
            {deadlineUrgent ? (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            ) : (
              <Clock className="h-4 w-4 shrink-0" />
            )}
            <span>
              {deadlineUrgent ? "Voting closes soon — " : "Time remaining: "}
              {formatTimeRemaining(msRemaining!)} left
            </span>
          </div>
        )}

        {election.description && (
          <Card>
            <CardContent className="py-3 px-4 text-sm text-muted-foreground">{election.description}</CardContent>
          </Card>
        )}

        {election.isSecretBallot ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This is a secret ballot. Your individual choice will be anonymized after submission — only the total count is recorded.
          </div>
        ) : null}

        <Card>
          <CardContent className="py-4 px-4 space-y-2">
            <div className="flex items-center justify-between mb-3">
              {/* 6.2: Selection instructions */}
              <div className="text-sm font-medium">
                {selectionInstruction}
              </div>
              {maxChoices && (
                <div className="text-xs text-muted-foreground">
                  {selectedOptions.length} of {maxChoices} selected
                </div>
              )}
            </div>
            {/* 6.3: ARIA attributes on options group */}
            <div
              role={groupRole}
              aria-label={`${election.title} ballot options`}
            >
              {options.map((opt, index) => {
                const selected = selectedOptions.includes(opt.id);
                const disabled = !selected && atMaxChoices;
                return (
                  <button
                    key={opt.id}
                    ref={(el) => { optionRefs.current[index] = el; }}
                    type="button"
                    role={optionRole}
                    aria-checked={selected}
                    aria-label={opt.label}
                    tabIndex={focusedIndex === index || (focusedIndex === -1 && index === 0) ? 0 : -1}
                    onClick={() => toggleOption(opt.id)}
                    onKeyDown={(e) => handleKeyDown(e, index, options.length)}
                    disabled={disabled}
                    className={`w-full rounded-lg border-2 px-4 py-4 sm:py-3 text-left transition-colors mb-2 min-h-[48px] ${
                      selected
                        ? "border-primary bg-primary/5"
                        : disabled
                          ? "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                          : "border-border bg-background hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                        {selected && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{opt.label}</div>
                        {opt.description && <div className="text-xs text-muted-foreground mt-0.5">{opt.description}</div>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 6.1: Submit button opens confirmation dialog — sticky on mobile */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 sm:static sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:p-0 z-10">
          <Button
            className="w-full"
            size="lg"
            onClick={() => { setBallotStep("confirm"); setShowConfirm(true); }}
            disabled={castMutation.isPending || selectedOptions.length === 0}
          >
            {castMutation.isPending ? "Submitting..." : "Submit Vote"}
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2 sm:pb-6">
            Your vote is final once submitted and cannot be changed.
          </p>
        </div>

        {/* 6.1: Confirmation dialog */}
        <Dialog open={showConfirm} onOpenChange={(open) => { setShowConfirm(open); if (!open) setBallotStep("select"); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Your Vote</DialogTitle>
              <DialogDescription>
                Please review your selection{selectedLabels.length > 1 ? "s" : ""} before submitting. Your vote cannot be changed after submission.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 my-2">
              <div className="text-sm font-medium text-muted-foreground">
                {selectedLabels.length > 1 ? "Your selections:" : "Your selection:"}
              </div>
              <ul className="space-y-1">
                {selectedLabels.map((label) => (
                  <li key={label} className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Go Back
              </Button>
              <Button
                onClick={() => castMutation.mutate(selectedOptions)}
                disabled={castMutation.isPending}
              >
                {castMutation.isPending ? "Submitting..." : "Confirm & Submit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
