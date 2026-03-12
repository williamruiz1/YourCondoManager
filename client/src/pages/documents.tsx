import { useEffect, useRef, useState } from "react";
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
import { Plus, FileText, Upload, Download, Tags, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useActiveAssociation } from "@/hooks/use-active-association";

const documentTypes = ["Meeting Minutes", "Bylaws", "Financial Report", "Insurance", "Legal", "Maintenance", "Other"];

const formSchema = z.object({
  associationId: z.string().min(1, "Association is required"),
  title: z.string().min(1, "Title is required"),
  documentType: z.string().min(1, "Document type is required"),
  uploadedBy: z.string().optional(),
});

const addTagSchema = z.object({
  entityType: z.string().min(1, "Entity type is required"),
  entityId: z.string().min(1, "Entity id is required"),
});

const addVersionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  uploadedBy: z.string().optional(),
});

function getAdminHeaders() {
  const apiKey = window.localStorage.getItem("adminApiKey") || "dev-admin-key";
  const adminUserEmail = window.localStorage.getItem("adminUserEmail") || "admin@local";
  return {
    "x-admin-api-key": apiKey,
    "x-admin-user-email": adminUserEmail,
  };
}

export default function DocumentsPage() {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [metaOpen, setMetaOpen] = useState(false);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const versionFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  const { data: documents, isLoading } = useQuery<Document[]>({ queryKey: ["/api/documents"] });
  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });

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
    defaultValues: { associationId: "", title: "", documentType: "", uploadedBy: "" },
  });

  useEffect(() => {
    form.setValue("associationId", activeAssociationId, { shouldValidate: true });
  }, [activeAssociationId, form]);

  const tagForm = useForm<z.infer<typeof addTagSchema>>({
    resolver: zodResolver(addTagSchema),
    defaultValues: { entityType: "association", entityId: "" },
  });

  const versionForm = useForm<z.infer<typeof addVersionSchema>>({
    resolver: zodResolver(addVersionSchema),
    defaultValues: { title: "", uploadedBy: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const formData = new FormData();
      formData.append("associationId", data.associationId);
      formData.append("title", data.title);
      formData.append("documentType", data.documentType);
      if (data.uploadedBy) formData.append("uploadedBy", data.uploadedBy);
      if (selectedFile) formData.append("file", selectedFile);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
        headers: getAdminHeaders(),
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Document uploaded successfully" });
      setOpen(false);
      form.reset({ associationId: activeAssociationId, title: "", documentType: "", uploadedBy: "" });
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
    mutationFn: async (data: z.infer<typeof addVersionSchema>) => {
      if (!selectedDocument) throw new Error("No document selected");
      if (!versionFile) throw new Error("File is required");

      const formData = new FormData();
      formData.append("title", data.title);
      if (data.uploadedBy) formData.append("uploadedBy", data.uploadedBy);
      formData.append("file", versionFile);

      const res = await fetch(`/api/documents/${selectedDocument.id}/versions`, {
        method: "POST",
        body: formData,
        headers: getAdminHeaders(),
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      return res.json();
    },
    onSuccess: () => {
      if (!selectedDocument) return;
      queryClient.invalidateQueries({ queryKey: ["/api/documents", selectedDocument.id, "versions"] });
      versionForm.reset({ title: "", uploadedBy: "" });
      setVersionFile(null);
      toast({ title: "Version uploaded" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!selectedFile) {
      toast({ title: "Please select a file to upload", variant: "destructive" });
      return;
    }
    createMutation.mutate(values);
  }

  function onSubmitTag(values: z.infer<typeof addTagSchema>) {
    createTagMutation.mutate(values);
  }

  function onSubmitVersion(values: z.infer<typeof addVersionSchema>) {
    createVersionMutation.mutate(values);
  }

  const getAssocName = (id: string) => associations?.find((a) => a.id === id)?.name ?? "Unknown";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Documents</h1>
          <p className="text-muted-foreground">Upload and manage documents for the current association context.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { form.reset(); setSelectedFile(null); } }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-document" disabled={!activeAssociationId}><Plus className="h-4 w-4 mr-2" />Upload Document</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
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
                <div>
                  <FormLabel>File</FormLabel>
                  <div
                    className="mt-2 border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover-elevate"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="input-document-file"
                  >
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    {selectedFile ? (
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Click to select a file</p>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-document">
                  {createMutation.isPending ? "Uploading..." : "Upload"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !documents?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium" data-testid="text-empty-state">No documents yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Upload documents for your associations.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Association</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((d) => (
                  <TableRow key={d.id} data-testid={`row-document-${d.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{d.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{getAssocName(d.associationId)}</TableCell>
                    <TableCell><Badge variant="secondary">{d.documentType}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{d.uploadedBy || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedDocument(d);
                          setMetaOpen(true);
                        }}
                      >
                        <Tags className="h-3 w-3 mr-1" />
                        Manage
                      </Button>
                      <Button variant="outline" size="sm" asChild data-testid={`button-download-document-${d.id}`}>
                        <a href={d.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3 w-3 mr-1" />Download
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedDocument ? `Manage: ${selectedDocument.title}` : "Manage Document"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Tags className="h-4 w-4" />
                Tags
              </div>
              <div className="space-y-2 max-h-44 overflow-auto border rounded-md p-3">
                {tags?.length ? (
                  tags.map((tag) => (
                    <div key={tag.id} className="text-sm text-muted-foreground">
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
              <div className="space-y-2 max-h-44 overflow-auto border rounded-md p-3">
                {versions?.length ? (
                  versions.map((version) => (
                    <div key={version.id} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium">v{version.versionNumber}: {version.title}</p>
                        <p className="text-muted-foreground">{new Date(version.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={version.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3 w-3 mr-1" />Open
                        </a>
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No versions</p>
                )}
              </div>
              <Form {...versionForm}>
                <form onSubmit={versionForm.handleSubmit(onSubmitVersion)} className="space-y-3">
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
