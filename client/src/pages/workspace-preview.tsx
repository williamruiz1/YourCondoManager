import { ArrowRight, BellRing, Building2, CircleDollarSign, FileText, LockKeyhole, ShieldCheck, Users } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WorkspacePreviewPageProps = {
  onOpenAdminAuth: () => void;
};

const modulePreview = [
  { label: "Portfolio overview", detail: "A live dashboard for associations, context switching, and operational visibility.", icon: Building2 },
  { label: "Governance + finance", detail: "Meetings, compliance, fees, ledgers, budgets, and payments without system hopping.", icon: CircleDollarSign },
  { label: "Records + communications", detail: "Documents, occupancy, owners, communications, and intake managed in one flow.", icon: FileText },
];

const workspaceSignals = [
  { title: "Association context", description: "Switch from portfolio oversight into a single building or association workflow instantly." },
  { title: "Financial controls", description: "Move from setup to invoices, utilities, payments, and owner ledger without changing systems." },
  { title: "Records and documents", description: "Keep people, units, ownership, board records, and documents aligned in one place." },
  { title: "Service workflow", description: "Handle resident outreach, portal access, and AI-supported intake from the same workspace." },
];

export default function WorkspacePreviewPage({
  onOpenAdminAuth,
}: WorkspacePreviewPageProps) {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,_rgba(20,83,45,0.08),_transparent_26%),linear-gradient(180deg,_hsl(var(--muted)),_hsl(var(--background)))]">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 md:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-[0.16em] uppercase text-muted-foreground">Workspace Preview</div>
            <div className="text-sm text-muted-foreground">A pre-auth look at a more modern property management workspace</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-border/70 bg-card/95 shadow-lg">
            <CardHeader className="space-y-4">
              <Badge className="w-fit rounded-full">Pre-logged-in</Badge>
              <CardTitle className="text-3xl leading-tight">See how the platform modernizes day-to-day property operations.</CardTitle>
              <p className="text-sm text-muted-foreground">
                Review the workspace structure, then configure admin auth to enter the live environment.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={onOpenAdminAuth} data-testid="button-workspace-preview-admin-auth">
                <LockKeyhole className="mr-2 h-4 w-4" />
                Configure Admin Auth
              </Button>
              <Button variant="ghost" asChild data-testid="button-workspace-preview-return-home">
                <Link href="/">
                  Return Home
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {modulePreview.map((item) => (
              <Card key={item.label} className="border-border/70 bg-background/90">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">{item.label}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card className="border-border/70 bg-[linear-gradient(180deg,_rgba(255,255,255,0.92),_rgba(247,248,247,0.98))]">
          <CardHeader>
            <CardTitle className="text-xl">What opens inside the modern workspace</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workspaceSignals.map((lane) => (
              <div key={lane.title} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="flex items-center gap-2 font-medium">
                  <BellRing className="h-4 w-4 text-primary" />
                  {lane.title}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{lane.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
