// zone: Operations
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ResidentFeedback } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { operationsSubPages } from "@/lib/sub-page-nav";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { t } from "@/i18n/use-strings";

type FeedbackAnalytics = {
  total: number;
  avgScore: number | null;
  byCategory: Record<string, { count: number; avgScore: number | null }>;
  byStatus: Record<string, number>;
  scoreDistribution: Array<{ score: number; count: number }>;
};

const SCORE_LABELS: Record<number, string> = { 1: "Very Poor", 2: "Poor", 3: "Neutral", 4: "Good", 5: "Excellent" };
const CATEGORIES = ["maintenance", "management", "amenities", "communication", "neighbor", "financial", "general"] as const;

export default function ResidentFeedbackPage() {
  useDocumentTitle(t("residentFeedback.title"));
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { activeAssociationId } = useActiveAssociation();
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "in-review" | "resolved">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [noteDialogFeedback, setNoteDialogFeedback] = useState<ResidentFeedback | null>(null);
  const [adminNoteText, setAdminNoteText] = useState("");

  const { data: feedbacks = [] } = useQuery<ResidentFeedback[]>({
    queryKey: ["/api/feedback", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/feedback?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const { data: analytics } = useQuery<FeedbackAnalytics>({
    queryKey: ["/api/feedback/analytics", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return null;
      const res = await apiRequest("GET", `/api/feedback/analytics?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const updateFeedback = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status?: string; adminNotes?: string }) => {
      const res = await apiRequest("PATCH", `/api/feedback/${id}`, { status, adminNotes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback", activeAssociationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/feedback/analytics", activeAssociationId] });
      setNoteDialogFeedback(null);
      toast({ title: "Feedback updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = feedbacks.filter((f) => {
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
    return true;
  });

  const scoreBar = (score: number, count: number, max: number) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-4 text-right">{score}</span>
      <div className="flex-1 h-3 rounded bg-muted overflow-hidden">
        <div className="h-full bg-primary rounded" style={{ width: max > 0 ? `${(count / max) * 100}%` : "0%" }} />
      </div>
      <span className="w-6 text-muted-foreground">{count}</span>
    </div>
  );

  return (
    // Wave 27 a11y: section + aria-labelledby (heading id below).
    <section className="p-6 space-y-6" aria-labelledby="resident-feedback-heading">
      <WorkspacePageHeader
        title={t("residentFeedback.title")}
        headingId="resident-feedback-heading"
        summary={t("residentFeedback.summary")}
        eyebrow={t("common.eyebrow.operations")}
        breadcrumbs={[{ label: t("common.crumb.operations"), href: "/app/operations/dashboard" }, { label: t("residentFeedback.crumb") }]}
        subPages={operationsSubPages}
      />

      {!activeAssociationId ? (
        <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground text-center" role="status">{t("residentFeedback.empty.selectAssociation")}</div>
      ) : (
        <>
          {/* Analytics summary */}
          {analytics && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">{t("residentFeedback.stats.total")}</div>
                  <div className="text-2xl font-semibold">{analytics.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">{t("residentFeedback.stats.avg")}</div>
                  <div className={`text-2xl font-semibold ${analytics.avgScore !== null ? (analytics.avgScore >= 4 ? "text-green-600" : analytics.avgScore >= 3 ? "text-yellow-600" : "text-destructive") : ""}`}>
                    {analytics.avgScore !== null ? analytics.avgScore.toFixed(1) : "N/A"} <span className="text-sm font-normal text-muted-foreground">/ 5</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">{t("residentFeedback.stats.open")}</div>
                  <div className="text-2xl font-semibold">{analytics.byStatus["open"] ?? 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">{t("residentFeedback.stats.resolved")}</div>
                  <div className="text-2xl font-semibold">{analytics.byStatus["resolved"] ?? 0}</div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {/* Score distribution */}
            {analytics && (
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <h3 className="text-sm font-medium mb-3">{t("residentFeedback.section.scoreDistribution")}</h3>
                  {[5, 4, 3, 2, 1].map((s) => {
                    const item = analytics.scoreDistribution.find((d) => d.score === s);
                    const count = item?.count ?? 0;
                    const max = Math.max(...analytics.scoreDistribution.map((d) => d.count), 1);
                    return (
                      <div key={s} className="flex items-center gap-2 text-xs">
                        <span className="w-20 text-muted-foreground">{SCORE_LABELS[s]}</span>
                        {scoreBar(s, count, max)}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* By category */}
            {analytics && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-sm font-medium mb-3">{t("residentFeedback.section.byCategory")}</h3>
                  <div className="space-y-2">
                    {Object.entries(analytics.byCategory).sort((a, b) => b[1].count - a[1].count).map(([cat, data]) => (
                      <div key={cat} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{cat}</span>
                        <Badge variant="outline">{data.count}</Badge>
                      </div>
                    ))}
                    {Object.keys(analytics.byCategory).length === 0 && <div className="text-sm text-muted-foreground" role="status">{t("residentFeedback.empty.byCategory")}</div>}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Filters + table */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex gap-2 flex-wrap" role="group" aria-label="Status filter">
                {(["all", "open", "in-review", "resolved"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={statusFilter === s ? "default" : "outline"}
                    className="h-7 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    onClick={() => setStatusFilter(s)}
                    aria-pressed={statusFilter === s}
                  >
                    {s === "all" ? t("residentFeedback.filter.all") : s.charAt(0).toUpperCase() + s.slice(1)} {s !== "all" ? `(${feedbacks.filter(f => f.status === s).length})` : `(${feedbacks.length})`}
                  </Button>
                ))}
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-7 text-xs w-36" aria-label={t("residentFeedback.col.category")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("residentFeedback.filter.allCategories")}</SelectItem>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Wave 27 a11y: aria-label names this resident feedback table. */}
              <Table aria-label={t("residentFeedback.tableLabel")}>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("residentFeedback.col.subject")}</TableHead>
                    <TableHead>{t("residentFeedback.col.category")}</TableHead>
                    <TableHead>{t("residentFeedback.col.score")}</TableHead>
                    <TableHead>{t("residentFeedback.col.submitter")}</TableHead>
                    <TableHead>{t("residentFeedback.col.status")}</TableHead>
                    <TableHead>{t("residentFeedback.col.date")}</TableHead>
                    <TableHead className="text-right">{t("residentFeedback.col.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((fb) => (
                    <TableRow key={fb.id}>
                      <TableCell>
                        <div className="font-medium">{fb.subject || "(no subject)"}</div>
                        {fb.feedbackText && <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{fb.feedbackText}</div>}
                      </TableCell>
                      <TableCell><Badge variant="outline">{fb.category}</Badge></TableCell>
                      <TableCell>
                        {fb.satisfactionScore !== null ? (
                          <Badge variant={fb.satisfactionScore >= 4 ? "secondary" : fb.satisfactionScore >= 3 ? "outline" : "destructive"}>
                            {fb.satisfactionScore}/5
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-sm">{fb.isAnonymous ? "Anonymous" : (fb.personId ? fb.personId.slice(0, 8) + "..." : "-")}</TableCell>
                      <TableCell><Badge variant={fb.status === "resolved" ? "outline" : fb.status === "in-review" ? "secondary" : "destructive"}>{fb.status}</Badge></TableCell>
                      <TableCell className="text-sm">{new Date(fb.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {fb.status === "open" && (
                            <Button size="sm" variant="outline" onClick={() => updateFeedback.mutate({ id: fb.id, status: "in-review" })} aria-label={`${t("residentFeedback.action.review")}: ${fb.subject || fb.category}`}>{t("residentFeedback.action.review")}</Button>
                          )}
                          {fb.status !== "resolved" && (
                            <Button size="sm" variant="outline" onClick={() => updateFeedback.mutate({ id: fb.id, status: "resolved" })} aria-label={`${t("residentFeedback.action.resolve")}: ${fb.subject || fb.category}`}>{t("residentFeedback.action.resolve")}</Button>
                          )}
                          <Dialog open={noteDialogFeedback?.id === fb.id} onOpenChange={(open) => { if (!open) setNoteDialogFeedback(null); }}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" onClick={() => { setNoteDialogFeedback(fb); setAdminNoteText(fb.adminNotes || ""); }} aria-label={`${t("residentFeedback.action.note")}: ${fb.subject || fb.category}`}>{t("residentFeedback.action.note")}</Button>
                            </DialogTrigger>
                            <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-h-[85vh] sm:max-w-lg">
                              <DialogHeader><DialogTitle>{t("residentFeedback.dialog.noteTitle")}</DialogTitle></DialogHeader>
                              <div className="space-y-3">
                                <div className="text-sm">{fb.subject || "(no subject)"}</div>
                                {fb.feedbackText && <div className="text-sm text-muted-foreground bg-muted/30 rounded p-2">{fb.feedbackText}</div>}
                                <Textarea placeholder="Internal notes about this feedback..." value={adminNoteText} onChange={(e) => setAdminNoteText(e.target.value)} rows={3} aria-label={t("residentFeedback.dialog.noteTitle")} />
                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                  <Button className="w-full sm:w-auto" variant="outline" onClick={() => setNoteDialogFeedback(null)}>{t("common.action.cancel")}</Button>
                                  <Button className="w-full sm:w-auto" onClick={() => updateFeedback.mutate({ id: fb.id, adminNotes: adminNoteText })}>{t("residentFeedback.action.saveNote")}</Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground" role="status">{t("residentFeedback.empty.noResults")}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
