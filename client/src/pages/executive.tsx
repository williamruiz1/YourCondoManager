// zone: Platform
// persona: Platform Admin
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Presentation } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { platformSubPages } from "@/lib/sub-page-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { ExecutiveEvidence, ExecutiveUpdate } from "@shared/schema";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type EvidenceForm = {
  evidenceType: "release-note" | "metric" | "screenshot" | "link" | "note";
  label: string;
  value: string;
};

function distributeFeatures(features: string[], bucketCount: number): string[][] {
  if (bucketCount <= 0) return [];
  const buckets = Array.from({ length: bucketCount }, () => [] as string[]);
  if (features.length === 0) return buckets;

  const baseSize = Math.floor(features.length / bucketCount);
  const remainder = features.length % bucketCount;
  let cursor = 0;
  for (let i = 0; i < bucketCount; i += 1) {
    const size = baseSize + (i < remainder ? 1 : 0);
    buckets[i] = features.slice(cursor, cursor + size);
    cursor += size;
  }
  return buckets;
}

function normalizeLine(text: string): string {
  return text.replace(/^[-*]\s*/, "").trim();
}

function renderBoldLabelText(text: string) {
  const idx = text.indexOf(":");
  if (idx <= 0) return <>{text}</>;
  const label = text.slice(0, idx + 1);
  const body = text.slice(idx + 1).trim();
  return (
    <>
      <strong>{label}</strong> {body}
    </>
  );
}

export default function ExecutivePage() {
  useDocumentTitle("Executive");
  const { toast } = useToast();
  const { data: updates = [], isLoading } = useQuery<ExecutiveUpdate[]>({ queryKey: ["/api/admin/executive/updates"] });

  const projectSlides = useMemo(
    () => {
      const normalizeTitle = (title: string) =>
        title
          .toLowerCase()
          .replace(/\s+completed$/, "")
          .replace(/\s+/g, " ")
          .trim();

      const slideCandidates = updates.filter((row) => row.sourceKey?.startsWith("slide:") && row.status === "published");
      const byKey = new Map<string, ExecutiveUpdate>();

      const score = (row: ExecutiveUpdate) => {
        const sourceBonus = row.sourceKey?.startsWith("slide:roadmap-project:") ? 1000 : 0;
        const dateScore = row.deliveredAt ? new Date(row.deliveredAt).getTime() : 0;
        return sourceBonus + dateScore;
      };

      for (const row of slideCandidates) {
        const key = row.projectId ? `project:${row.projectId}` : `title:${normalizeTitle(row.title)}`;
        const existing = byKey.get(key);
        if (!existing || score(row) > score(existing)) {
          byKey.set(key, row);
        }
      }

      return Array.from(byKey.values()).sort((a, b) => {
        const aTime = a.deliveredAt ? new Date(a.deliveredAt).getTime() : 0;
        const bTime = b.deliveredAt ? new Date(b.deliveredAt).getTime() : 0;
        return bTime - aTime;
      });
    },
    [updates],
  );

  const [slideIndex, setSlideIndex] = useState(0);
  const [selectedUpdateId, setSelectedUpdateId] = useState<string>("");

  useEffect(() => {
    if (!projectSlides.length) {
      setSelectedUpdateId("");
      return;
    }
    const clamped = Math.max(0, Math.min(slideIndex, projectSlides.length - 1));
    if (clamped !== slideIndex) setSlideIndex(clamped);
    const active = projectSlides[clamped];
    if (active && active.id !== selectedUpdateId) {
      setSelectedUpdateId(active.id);
    }
  }, [projectSlides, slideIndex, selectedUpdateId]);

  const activeSlide = projectSlides[slideIndex] ?? null;

  const { data: evidence = [] } = useQuery<ExecutiveEvidence[]>({
    queryKey: ["/api/admin/executive/updates", selectedUpdateId || "none", "evidence"],
    enabled: Boolean(selectedUpdateId),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/executive/updates/${selectedUpdateId}/evidence`);
      return res.json();
    },
  });

  const evidenceForm = useForm<EvidenceForm>({
    defaultValues: {
      evidenceType: "note",
      label: "",
      value: "",
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/executive/sync", {});
      return res.json() as Promise<{ created: number; updated: number }>;
    },
    onSuccess: (result) => {
      toast({
        title: "Executive updates synced",
        description: `Created ${result.created}, updated ${result.updated}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/executive/updates"] });
    },
    onError: (error: any) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      const nowIso = new Date().toISOString();
      const res = await apiRequest("POST", "/api/admin/executive/updates", {
        title: "New Project Slide Template",
        headline: "Template: Replace with project headline",
        summary: "Template row for executive deck slide.",
        problemStatement: "- Problem Context: Replace with concise problem statement",
        solutionSummary: "- Solution Approach: Replace with concise solution statement",
        featuresDelivered: ["Feature Highlight: Replace with delivered feature"],
        businessValue: "Template for stakeholder-ready project summary.",
        status: "draft",
        sourceType: "manual",
        sourceKey: `slide:template:${Date.now()}`,
        projectId: null,
        workstreamId: null,
        taskId: null,
        deliveredAt: nowIso,
        displayOrder: 999,
      });
      return res.json() as Promise<ExecutiveUpdate>;
    },
    onSuccess: (created) => {
      toast({ title: "Slide template created" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/executive/updates"] });
      const idx = projectSlides.findIndex((slide) => slide.id === created.id);
      if (idx >= 0) setSlideIndex(idx);
    },
    onError: (error: any) => {
      toast({ title: "Template creation failed", description: error.message, variant: "destructive" });
    },
  });

  const createEvidenceMutation = useMutation({
    mutationFn: async (payload: EvidenceForm) => {
      if (!selectedUpdateId) throw new Error("Select a slide first.");
      const res = await apiRequest("POST", `/api/admin/executive/updates/${selectedUpdateId}/evidence`, payload);
      return res.json() as Promise<ExecutiveEvidence>;
    },
    onSuccess: () => {
      toast({ title: "Evidence log added" });
      evidenceForm.reset({ evidenceType: "note", label: "", value: "" });
      if (selectedUpdateId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/executive/updates", selectedUpdateId, "evidence"] });
      }
    },
    onError: (error: any) => {
      toast({ title: "Evidence add failed", description: error.message, variant: "destructive" });
    },
  });

  const features = activeSlide?.featuresDelivered ?? [];
  const problemNotes = (activeSlide?.problemStatement ?? "")
    .split("\n")
    .map((line) => normalizeLine(line))
    .filter(Boolean);
  const solutionNotes = (activeSlide?.solutionSummary ?? "")
    .split("\n")
    .map((line) => normalizeLine(line))
    .filter(Boolean);
  const normalizedProblems = problemNotes.length > 0 ? problemNotes : [activeSlide?.problemStatement || activeSlide?.summary || "Problem details pending."];
  const featureGroups = distributeFeatures(features, normalizedProblems.length);
  const tableRows = normalizedProblems.map((problem, idx) => {
    const mappedSolution =
      solutionNotes[idx] ||
      solutionNotes[0] ||
      activeSlide?.solutionSummary ||
      activeSlide?.businessValue ||
      "Solution details pending.";
    const mappedFeatures = featureGroups[idx] || [];
    return {
      problem,
      solution: normalizeLine(mappedSolution),
      features: mappedFeatures.map((item) => normalizeLine(item)),
    };
  });

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="page-executive">
      <WorkspacePageHeader
        title="Executive Delivery Deck"
        summary="Slide format: one project per slide with a problem-solution-features table."
        eyebrow="Platform"
        breadcrumbs={[{ label: "Platform", href: "/app/platform/controls" }, { label: "Executive Delivery Deck" }]}
        subPages={platformSubPages}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => createTemplateMutation.mutate()} disabled={createTemplateMutation.isPending} data-testid="button-create-slide-template">
              {createTemplateMutation.isPending ? "Creating..." : "Create Slide Template"}
            </Button>
            <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} data-testid="button-sync-executive-from-roadmap">
              {syncMutation.isPending ? "Syncing..." : "Sync from Roadmap"}
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="highlights" className="space-y-4">
        <TabsList>
          <TabsTrigger value="highlights">Highlights Deck</TabsTrigger>
          <TabsTrigger value="defend">Defend</TabsTrigger>
        </TabsList>

        <TabsContent value="highlights" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-10 text-sm text-muted-foreground">Loading executive slides...</CardContent>
            </Card>
          ) : !activeSlide ? (
            <EmptyState
              icon={Presentation}
              title="No project slides available yet"
              description="Executive slides will appear here once the platform admin publishes the next quarterly review."
              testId="empty-executive-slides"
            />
          ) : (
            <Card className="w-full lg:w-[85%] lg:mx-auto" data-testid={`slide-executive-${activeSlide.id}`}>
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge>Slide {slideIndex + 1} of {projectSlides.length}</Badge>
                    <Badge variant={activeSlide.status === "published" ? "default" : "secondary"}>{activeSlide.status}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={slideIndex <= 0}
                      onClick={() => setSlideIndex((prev) => Math.max(0, prev - 1))}
                      data-testid="button-slide-prev"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={slideIndex >= projectSlides.length - 1}
                      onClick={() => setSlideIndex((prev) => Math.min(projectSlides.length - 1, prev + 1))}
                      data-testid="button-slide-next"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-2xl">{activeSlide.headline}</CardTitle>
                <CardDescription className="text-sm">{activeSlide.title}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border p-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left p-2 font-medium">Problem</th>
                          <th className="text-left p-2 font-medium">Solution</th>
                          <th className="text-left p-2 font-medium">Features Delivered</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row, idx) => (
                          <tr key={`${row.problem}-${idx}`} className="border-b last:border-b-0 align-top">
                            <td className="p-2">{renderBoldLabelText(row.problem)}</td>
                            <td className="p-2">{renderBoldLabelText(row.solution)}</td>
                            <td className="p-2">
                              {row.features.length === 0 ? (
                                <span className="text-muted-foreground">No features listed.</span>
                              ) : (
                                <ul className="list-disc pl-5 space-y-1">
                                  {row.features.map((feature) => (
                                    <li key={`${row.problem}-${feature}`}>{renderBoldLabelText(feature)}</li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="defend" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Defend Log</CardTitle>
              <CardDescription>Attach proof points to the selected slide.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={selectedUpdateId || "none"}
                onValueChange={(v) => {
                  const next = v === "none" ? "" : v;
                  setSelectedUpdateId(next);
                  const idx = projectSlides.findIndex((slide) => slide.id === next);
                  if (idx >= 0) setSlideIndex(idx);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project slide" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select slide</SelectItem>
                  {projectSlides.map((slide) => (
                    <SelectItem key={slide.id} value={slide.id}>
                      {slide.headline}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <form
                className="grid grid-cols-1 md:grid-cols-3 gap-3"
                onSubmit={evidenceForm.handleSubmit((values) => createEvidenceMutation.mutate(values))}
              >
                <Select value={evidenceForm.watch("evidenceType")} onValueChange={(v) => evidenceForm.setValue("evidenceType", v as EvidenceForm["evidenceType"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="metric">Metric</SelectItem>
                    <SelectItem value="link">Link</SelectItem>
                    <SelectItem value="release-note">Release Note</SelectItem>
                    <SelectItem value="screenshot">Screenshot</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Label" {...evidenceForm.register("label", { required: true })} />
                <Input placeholder="Value / URL / Metric" {...evidenceForm.register("value", { required: true })} />
                <div className="md:col-span-3">
                  <Button type="submit" disabled={createEvidenceMutation.isPending || !selectedUpdateId}>
                    {createEvidenceMutation.isPending ? "Saving..." : "Add Evidence"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evidence Entries</CardTitle>
              <CardDescription>
                {activeSlide ? `Evidence for: ${activeSlide.headline}` : "Select a slide to view evidence."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {evidence.length === 0 ? (
                <p className="text-sm text-muted-foreground">No evidence logged yet.</p>
              ) : (
                evidence.map((entry) => (
                  <div key={entry.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Badge variant="outline">{entry.evidenceType}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm font-medium">{entry.label}</p>
                    <p className="text-sm text-muted-foreground break-all">{entry.value}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
