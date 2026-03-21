import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Document, Association, DocumentTag, DocumentVersion } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, FileText, Upload, Download, Tags, History, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { AssociationScopeBanner } from "@/components/association-scope-banner";
import { AsyncStateBoundary } from "@/components/async-state-boundary";
import { DataTableShell } from "@/components/data-table-shell";
import { TaskFlowChecklist } from "@/components/task-flow-checklist";

const documentTypes = ["Meeting Minutes", "Bylaws", "Financial Report", "Insurance", "Legal", "Maintenance", "Other"];

const formSchema = z.object({
  associationId: z.string().min(1, "Association is required"),
  title: z.string().min(1, "Title is required"),
  documentType: z.string().min(1, "Document type is required"),
  uploadedBy: z.string().optional(),
  isPortalVisible: z.boolean().default(false),
  portalAudience: z.enum(["owner", "all"]).default("owner"),
});

const addTagSchema = z.object({
  entityType: z.string().min(1, "Entity type is required"),
  entityId: z.string().min(1, "Entity id is required"),
});

const addVersionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  uploadedBy: z.string().optional(),
});


export default function DocumentsPage() {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [metaOpen, setMetaOpen] = useState(false);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [uploadStage, setUploadStage] = useState<"select" | "details" | "uploading" | "complete">("select");
  const [versionStage, setVersionStage] = useState<"select" | "details" | "uploading" | "complete">("select");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const versionFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  const { data: documents, isLoading } = useQuery<Document[]>({ queryKey: ["/api/documents"] });
  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });
  const { data: missingFilesData } = useQuery<{ missingIds: string[] }>({
    queryKey: ["/api/documents/missing-files"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documents/missing-files");
      return res.json();
    },
  });
  const missingFileIds = useMemo(() => new Set(missingFilesData?.missingIds ?? []), [missingFilesData]);

  const { data: tags } = useQuery<DocumentTag[]>({
    queryKey: ["/api/documents", selectedDocument?.id, "tags"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/documents/${selectedDocument?.id}/tags`);
      return res.json();
    },
    enabled: Boolean(selectedDocument?.id && metaOpen),
  });

  const { data: versions } = useQuery<DocumentVersion[]>({
    queryKey: ["/api/documents", selectedDocument?.id, "versions"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/documents/${selectedDocument?.id}/versions`);
      return res.json();
    },
    enabled: Boolean(selectedDocument?.id && metaOpen),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { associationId: "", title: "", documentType: "", uploadedBy: "", isPortalVisible: false, portalAudience: "owner" },
  });

  const tagForm = useForm<z.infer<typeof addTagSchema>>({
    resolver: zodResolver(addTagSchema),
    defaultValues: { entityType: "association", entityId: "" },
  });

  const versionForm = useForm<z.infer<typeof addVersionSchema>>({
    resolver: zodResolver(addVersionSchema),
    defaultValues: { title: "", uploadedBy: "" },
  });
  const watchedTitle = form.watch("title");
  const watchedDocumentType = form.watch("documentType");
  const watchedVersionTitle = versionForm.watch("title");

  useEffect(() => {
    form.setValue("associationId", activeAssociationId, { shouldValidate: true });
  }, [activeAssociationId, form]);

  useEffect(() => {
    if (!selectedFile) {
      setUploadStage("select");
      return;
    }
    setUploadStage(watchedTitle && watchedDocumentType ? "details" : "select");
  }, [selectedFile, watchedDocumentType, watchedTitle]);

  useEffect(() => {
    if (!versionFile) {
      setVersionStage("select");
      return;
    }
    setVersionStage(watchedVersionTitle ? "details" : "select");
  }, [versionFile, watchedVersionTitle]);

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema> & { fileName: string }) => {
      const formData = new FormData();
      formData.append("associationId", data.associationId);
      formData.append("title", data.title);
      formData.append("documentType", data.documentType);
      if (data.uploadedBy) formData.append("uploadedBy", data.uploadedBy);
      formData.append("isPortalVisible", data.isPortalVisible ? "1" : "0");
      formData.append("portalAudience", data.portalAudience);
      if (selectedFile) formData.append("file", selectedFile);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Document uploaded",
        description: variables.fileName,
      });
      setUploadStage("complete");
      setOpen(false);
      form.reset({ associationId: activeAssociationId, title: "", documentType: "", uploadedBy: "", isPortalVisible: false, portalAudience: "owner" });
      setSelectedFile(null);
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const createTagMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addTagSchema>) => {
      if (!selectedDocument) throw new Error("No document selected");
      const res = await apiRequest("POST", `/api/documents/${selectedDocument.id}/tags`, data);
      return res.json();
    },
    onSuccess: () => {
      if (!selectedDocument) return;
      queryClient.invalidateQueries({ queryKey: ["/api/documents", selectedDocument.id, "tags"] });
      tagForm.reset({ entityType: "association", entityId: "" });
      toast({ title: "Tag added" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const createVersionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addVersionSchema> & { fileName: string }) => {
      if (!selectedDocument) throw new Error("No document selected");
      if (!versionFile) throw new Error("File is required");

      const formData = new FormData();
      formData.append("title", data.title);
      if (data.uploadedBy) formData.append("uploadedBy", data.uploadedBy);
      formData.append("file", versionFile);

      const res = await fetch(`/api/documents/${selectedDocument.id}/versions`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      if (!selectedDocument) return;
      queryClient.invalidateQueries({ queryKey: ["/api/documents", selectedDocument.id, "versions"] });
      versionForm.reset({ title: "", uploadedBy: "" });
      setVersionFile(null);
      setVersionStage("complete");
      toast({
        title: "Version uploaded",
        description: variables.fileName,
      });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const togglePortalVisibility = useMutation({
    mutationFn: async ({ id, isPortalVisible }: { id: string; isPortalVisible: boolean }) => {
      const res = await apiRequest("PATCH", `/api/documents/${id}`, { isPortalVisible: isPortalVisible ? 1 : 0 });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!selectedFile) {
      toast({ title: "Please select a file to upload", variant: "destructive" });
      return;
    }
    setUploadStage("uploading");
    createMutation.mutate({ ...values, fileName: selectedFile.name });
  }

  function onSubmitTag(values: z.infer<typeof addTagSchema>) {
    createTagMutation.mutate(values);
  }

  function onSubmitVersion(values: z.infer<typeof addVersionSchema>) {
    setVersionStage("uploading");
    createVersionMutation.mutate({ ...values, fileName: versionFile?.name || "Document version" });
  }

  const getAssocName = (id: string) => associations?.find((a) => a.id === id)?.name ?? "Unknown";
  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = [...(documents ?? [])].filter((document) => {
      if (!term) return true;
      return [
        document.title,
        document.documentType,
        document.uploadedBy,
        getAssocName(document.associationId),
      ].some((value) => (value || "").toLowerCase().includes(term));
    });

    rows.sort((left, right) => {
      if (sortBy === "oldest") return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      if (sortBy === "title") return left.title.localeCompare(right.title);
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
    return rows;
  }, [documents, search, sortBy, associations]);

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / 10));
  const pagedDocuments = filteredDocuments.slice((page - 1) * 10, page * 10);

  useEffect(() => {
    setPage(1);
  }, [search, sortBy]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="p-6 space-y-6">
      <WorkspacePageHeader
        title="Documents"
        summary="Upload, classify, and manage documents for the active association without losing workspace context."
        eyebrow="Records"
        breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Documents" }]}
        shortcuts={[
          { label: "Open Association Context", href: "/app/association-context" },
          { label: "Open Communications", href: "/app/communications" },
        ]}
        actions={<Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { form.reset(); setSelectedFile(null); setUploadStage("select"); } }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-document" disabled={!activeAssociationId}><Plus className="h-4 w-4 mr-2" />Upload Document</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
            <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
                  </div>
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl><Input data-testid="input-document-title" placeholder="2024 Annual Meeting Minutes" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="documentType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-document-type"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {documentTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="uploadedBy" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Uploaded By</FormLabel>
                      <FormControl><Input data-testid="input-document-uploader" placeholder="Admin" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="isPortalVisible" render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">Make visible in Owner Portal</FormLabel>
                    </FormItem>
                  )} />
                  {form.watch("isPortalVisible") && (
                    <FormField control={form.control} name="portalAudience" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Portal Audience</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="owner">Owner only</SelectItem>
                            <SelectItem value="all">All portal users</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                  <div>
                    <FormLabel>File</FormLabel>
                    <div
                      className="mt-2 border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover-elevate"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="input-document-file"
                    >
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      {selectedFile ? (
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">{Math.max(1, Math.round(selectedFile.size / 1024))} KB selected</p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Click to select a file</p>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          setSelectedFile(e.target.files?.[0] ?? null);
                          setUploadStage(e.target.files?.[0] ? "select" : "select");
                        }}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-document">
                    {createMutation.isPending ? "Uploading..." : "Upload"}
                  </Button>
                </form>
              </Form>

              <div className="space-y-4">
                <TaskFlowChecklist
                  title="Upload Workflow"
                  description="Move through the filing steps before the document enters the repository."
                  activeLabel={createMutation.isPending ? "Uploading" : uploadStage === "complete" ? "Uploaded" : undefined}
                  steps={[
                    { label: "Select the file", detail: selectedFile ? selectedFile.name : "Choose the source file to upload.", done: Boolean(selectedFile) },
                    { label: "Describe the record", detail: watchedTitle && watchedDocumentType ? `${watchedDocumentType} · ${watchedTitle}` : "Set a title and document type so the record can be found later.", done: Boolean(watchedTitle && watchedDocumentType) },
                    { label: "Confirm context", detail: activeAssociationName || "No active association selected.", done: Boolean(activeAssociationId) },
                    { label: "Upload and publish to the repository", detail: createMutation.isPending ? "Upload in progress." : "Submit when the file and details are ready.", done: uploadStage === "complete" },
                  ]}
                />
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <div className="text-sm font-medium">Ready-to-upload summary</div>
                    <div className="text-sm text-muted-foreground">Association: {activeAssociationName || "None selected"}</div>
                    <div className="text-sm text-muted-foreground">File: {selectedFile?.name || "No file selected"}</div>
                    <div className="text-sm text-muted-foreground">Title: {watchedTitle || "Not set"}</div>
                    <div className="text-sm text-muted-foreground">Type: {watchedDocumentType || "Not set"}</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </DialogContent>
        </Dialog>}
      />

      <AssociationScopeBanner
        activeAssociationId={activeAssociationId}
        activeAssociationName={activeAssociationName}
        explanation={
          activeAssociationId
            ? "Uploads, metadata changes, and document versions are applied to the active association context."
            : "Select an association before uploading or organizing documents."
        }
      />

      <AsyncStateBoundary
        isLoading={isLoading}
        isEmpty={!isLoading && !documents?.length}
        emptyTitle="No documents yet"
        emptyMessage="Store CC&Rs, bylaws, minutes, and insurance records here. Upload the first file to start the library."
      >
        <DataTableShell
          title="Document Repository"
          description="Search and sort records before drilling into metadata and versions."
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search title, type, uploader, or association"
          summary={`${filteredDocuments.length} documents`}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          filterSlot={
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="title">Title A-Z</SelectItem>
              </SelectContent>
            </Select>
          }
        >
          <Card>
            <CardContent className="p-0">
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Association</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Uploaded By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Owner Portal</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedDocuments.map((d) => (
                      <TableRow key={d.id} data-testid={`row-document-${d.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{d.title}</span>
                            {missingFileIds.has(d.id) && (
                              <span title="File not found on server" className="flex items-center gap-1 text-xs text-destructive">
                                <AlertTriangle className="h-3 w-3" />
                                Missing
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{getAssocName(d.associationId)}</TableCell>
                        <TableCell><Badge variant="secondary">{d.documentType}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{d.uploadedBy || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={Boolean(d.isPortalVisible)}
                              onCheckedChange={(checked) => togglePortalVisibility.mutate({ id: d.id, isPortalVisible: checked })}
                              aria-label="Toggle owner portal visibility"
                            />
                            {d.isPortalVisible ? (
                              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                <Eye className="h-3 w-3" />Visible
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <EyeOff className="h-3 w-3" />Hidden
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="icon"
                            title="Manage"
                            onClick={() => {
                              setSelectedDocument(d);
                              setMetaOpen(true);
                            }}
                          >
                            <Tags className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" title="Download" asChild data-testid={`button-download-document-${d.id}`}>
                            <a href={d.fileUrl} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 p-4 md:hidden">
                {pagedDocuments.map((d) => (
                  <div key={d.id} data-testid={`row-document-${d.id}`} className="rounded-xl border p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="break-words text-sm font-medium">{d.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {getAssocName(d.associationId)} · {new Date(d.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{d.documentType}</Badge>
                      {missingFileIds.has(d.id) ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />Missing
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">{d.uploadedBy || "Uploader not set"}</div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={Boolean(d.isPortalVisible)}
                          onCheckedChange={(checked) => togglePortalVisibility.mutate({ id: d.id, isPortalVisible: checked })}
                          aria-label="Toggle owner portal visibility"
                        />
                        {d.isPortalVisible ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <Eye className="h-3 w-3" />Visible
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <EyeOff className="h-3 w-3" />Hidden
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedDocument(d);
                          setMetaOpen(true);
                        }}
                      >
                        Manage
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href={d.fileUrl} target="_blank" rel="noopener noreferrer">
                          Open
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild data-testid={`button-download-document-${d.id}`}>
                        <a href={d.fileUrl} download>
                          Download
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </DataTableShell>
      </AsyncStateBoundary>

      <Dialog
        open={metaOpen}
        onOpenChange={(isOpen) => {
          setMetaOpen(isOpen);
          if (!isOpen) {
            setSelectedDocument(null);
            tagForm.reset({ entityType: "association", entityId: "" });
            versionForm.reset({ title: "", uploadedBy: "" });
            setVersionFile(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDocument ? `Manage: ${selectedDocument.title}` : "Manage Document"}</DialogTitle>
          </DialogHeader>
          {selectedDocument ? (
            <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="break-words text-sm font-medium">{selectedDocument.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {selectedDocument.documentType} · {getAssocName(selectedDocument.associationId)}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={selectedDocument.fileUrl} target="_blank" rel="noopener noreferrer">
                    Open
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={selectedDocument.fileUrl} download>
                    Download
                  </a>
                </Button>
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Tags className="h-4 w-4" />
                Tags
              </div>
              <div className="space-y-2 max-h-44 overflow-auto rounded-md border p-3">
                {tags?.length ? (
                  tags.map((tag) => (
                    <div key={tag.id} className="break-all text-sm text-muted-foreground">
                      <Badge variant="outline">{tag.entityType}</Badge>
                      <span className="ml-2">{tag.entityId}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No tags</p>
                )}
              </div>
              <Form {...tagForm}>
                <form onSubmit={tagForm.handleSubmit(onSubmitTag)} className="space-y-3">
                  <FormField
                    control={tagForm.control}
                    name="entityType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entity Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="association">association</SelectItem>
                            <SelectItem value="unit">unit</SelectItem>
                            <SelectItem value="person">person</SelectItem>
                            <SelectItem value="meeting">meeting</SelectItem>
                            <SelectItem value="ownership">ownership</SelectItem>
                            <SelectItem value="occupancy">occupancy</SelectItem>
                            <SelectItem value="board-role">board-role</SelectItem>
                            <SelectItem value="expense">expense</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={tagForm.control}
                    name="entityId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entity ID</FormLabel>
                        <FormControl><Input placeholder="Entity identifier" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={createTagMutation.isPending}>
                    {createTagMutation.isPending ? "Saving..." : "Add Tag"}
                  </Button>
                </form>
              </Form>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <History className="h-4 w-4" />
                Versions
              </div>
              <div className="space-y-2 max-h-44 overflow-auto rounded-md border p-3">
                {versions?.length ? (
                  versions.map((version) => (
                    <div key={version.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium">v{version.versionNumber}: {version.title}</p>
                        <p className="text-muted-foreground">{new Date(version.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href={version.fileUrl} target="_blank" rel="noopener noreferrer">
                            Open
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href={version.fileUrl} download>
                            Download
                          </a>
                        </Button>
                      </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No versions</p>
                )}
              </div>
              <Form {...versionForm}>
                <form onSubmit={versionForm.handleSubmit(onSubmitVersion)} className="space-y-3">
                  <TaskFlowChecklist
                    title="Version Filing Workflow"
                    description="Attach a replacement version with enough context for future review."
                    activeLabel={createVersionMutation.isPending ? "Uploading" : versionStage === "complete" ? "Uploaded" : undefined}
                    steps={[
                      { label: "Choose the new file", detail: versionFile ? versionFile.name : "Select the updated file to replace or supplement the current version.", done: Boolean(versionFile) },
                      { label: "Describe the version", detail: watchedVersionTitle || "Add a title so the update is identifiable later.", done: Boolean(watchedVersionTitle) },
                      { label: "Attach it to the selected document", detail: selectedDocument?.title || "No document selected.", done: Boolean(selectedDocument?.id) },
                    ]}
                  />
                  <FormField
                    control={versionForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Version Title</FormLabel>
                        <FormControl><Input placeholder="Updated 2026 policy" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={versionForm.control}
                    name="uploadedBy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Uploaded By</FormLabel>
                        <FormControl><Input placeholder="Admin" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div>
                    <FormLabel>File</FormLabel>
                    <div
                      className="mt-2 border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover-elevate"
                      onClick={() => versionFileInputRef.current?.click()}
                    >
                      <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                      {versionFile ? <p className="text-sm font-medium">{versionFile.name}</p> : <p className="text-sm text-muted-foreground">Click to select file</p>}
                      <input
                        ref={versionFileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => setVersionFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={createVersionMutation.isPending}>
                    {createVersionMutation.isPending ? "Uploading..." : "Upload Version"}
                  </Button>
                </form>
              </Form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
