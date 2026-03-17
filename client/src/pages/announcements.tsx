import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CommunityAnnouncement } from "@shared/schema";
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

const emptyForm = {
  title: "",
  body: "",
  priority: "normal" as "normal" | "important" | "urgent",
  authorName: "",
  publishedAt: "",
  expiresAt: "",
  isPinned: false,
  isPublished: false,
  targetAudience: "all",
};

export default function AnnouncementsPage() {
  const { toast } = useToast();
  const { activeAssociationId } = useActiveAssociation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CommunityAnnouncement | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: announcements = [] } = useQuery<CommunityAnnouncement[]>({
    queryKey: ["/api/announcements", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/announcements?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const saveAnnouncement = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("No association selected");
      const payload = {
        associationId: activeAssociationId,
        title: form.title,
        body: form.body,
        priority: form.priority,
        authorName: form.authorName || null,
        publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        isPinned: form.isPinned ? 1 : 0,
        isPublished: form.isPublished ? 1 : 0,
        targetAudience: form.targetAudience,
      };
      const res = editing
        ? await apiRequest("PATCH", `/api/announcements/${editing.id}`, payload)
        : await apiRequest("POST", "/api/announcements", payload);
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/announcements", activeAssociationId] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: editing ? "Announcement updated" : "Announcement created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteAnnouncement = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/announcements/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/announcements", activeAssociationId] });
      toast({ title: "Announcement deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: number }) => {
      const res = await apiRequest("PATCH", `/api/announcements/${id}`, {
        isPublished,
        publishedAt: isPublished ? new Date().toISOString() : null,
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/announcements", activeAssociationId] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function openEdit(a: CommunityAnnouncement) {
    setEditing(a);
    setForm({
      title: a.title,
      body: a.body,
      priority: a.priority as typeof form.priority,
      authorName: a.authorName || "",
      publishedAt: a.publishedAt ? new Date(a.publishedAt).toISOString().slice(0, 16) : "",
      expiresAt: a.expiresAt ? new Date(a.expiresAt).toISOString().slice(0, 16) : "",
      isPinned: Boolean(a.isPinned),
      isPublished: Boolean(a.isPublished),
      targetAudience: a.targetAudience,
    });
    setOpen(true);
  }

  const published = announcements.filter(a => a.isPublished).length;
  const pinned = announcements.filter(a => a.isPinned).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Community Announcements</h1>
          <p className="text-muted-foreground">Post announcements and bulletins visible to residents in the owner portal.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!activeAssociationId} onClick={() => { setEditing(null); setForm(emptyForm); }}>New Announcement</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? "Edit Announcement" : "Create Announcement"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Title *" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              <Textarea placeholder="Body *" value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={5} />
              <div className="grid gap-3 md:grid-cols-2">
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as typeof form.priority }))}>
                  <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={form.targetAudience} onValueChange={(v) => setForm((f) => ({ ...f, targetAudience: v }))}>
                  <SelectTrigger><SelectValue placeholder="Audience" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All residents</SelectItem>
                    <SelectItem value="owner">Owners only</SelectItem>
                    <SelectItem value="board">Board members</SelectItem>
                    <SelectItem value="tenant">Tenants only</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Author name" value={form.authorName} onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))} />
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Expires at (optional)</label>
                  <Input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isPinned} onChange={(e) => setForm((f) => ({ ...f, isPinned: e.target.checked }))} />
                  Pin to top
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} />
                  Publish immediately
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => saveAnnouncement.mutate()} disabled={!form.title.trim() || !form.body.trim() || saveAnnouncement.isPending}>
                  {editing ? "Save Changes" : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Total</div><div className="text-2xl font-semibold">{announcements.length}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Published</div><div className="text-2xl font-semibold">{published}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Pinned</div><div className="text-2xl font-semibold">{pinned}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {announcements.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {a.isPinned ? <Badge variant="outline" className="text-xs">📌</Badge> : null}
                      <div>
                        <div className="font-medium">{a.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{a.body}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.priority === "urgent" ? "destructive" : a.priority === "important" ? "secondary" : "outline"}>{a.priority}</Badge>
                  </TableCell>
                  <TableCell>{a.targetAudience}</TableCell>
                  <TableCell>
                    <Badge variant={a.isPublished ? "secondary" : "outline"}>{a.isPublished ? "Published" : "Draft"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{a.expiresAt ? new Date(a.expiresAt).toLocaleDateString() : "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => togglePublish.mutate({ id: a.id, isPublished: a.isPublished ? 0 : 1 })} disabled={togglePublish.isPending}>
                        {a.isPublished ? "Unpublish" : "Publish"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(a)}>Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => deleteAnnouncement.mutate(a.id)} disabled={deleteAnnouncement.isPending}>Delete</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {announcements.length === 0 && (
                <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">No announcements yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
