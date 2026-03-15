import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

type TaskStep = {
  label: string;
  detail: string;
  done: boolean;
};

export function TaskFlowChecklist({
  title,
  description,
  steps,
  activeLabel,
}: {
  title: string;
  description: string;
  steps: TaskStep[];
  activeLabel?: string;
}) {
  const completedCount = steps.filter((step) => step.done).length;
  const progress = steps.length ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-sm text-muted-foreground">{description}</div>
        </div>
        <Badge variant={progress === 100 ? "default" : "secondary"}>
          {activeLabel || `${completedCount}/${steps.length} complete`}
        </Badge>
      </div>

      <Progress value={progress} />

      <div className="space-y-2">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-start gap-3 rounded-md border bg-background/80 p-3">
            <div className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${step.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {index + 1}
            </div>
            <div>
              <div className="text-sm font-medium">{step.label}</div>
              <div className="text-xs text-muted-foreground">{step.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
