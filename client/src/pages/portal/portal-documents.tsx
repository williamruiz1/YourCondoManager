// zone: My Community
// persona: Owner
//
// 3.5 — PortalDocuments (/portal/documents) replaces the `documents` tab
// of the owner-portal.tsx mega-file. Nested under the My Community zone
// per the handoff (Documents has no 1.1 Q5 first-person zone of its own
// and surfaces most naturally as community-scoped shared resources).

import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Document } from "@shared/schema";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PortalShell, usePortalContext } from "./portal-shell";

function DocumentsContent() {
  const { portalFetch, session } = usePortalContext();

  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ["portal/documents", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/documents");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const downloadDocument = async (doc: Document) => {
    if (!doc.fileUrl) return;
    try {
      const res = await portalFetch(doc.fileUrl);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.title || "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      /* silently fail */
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6" data-testid="portal-documents">
      <div>
        <Link href="/portal/community" className="text-xs font-semibold text-primary hover:underline">
          ← Back to My Community
        </Link>
        <h1 className="mt-2 font-headline text-3xl md:text-4xl" data-testid="portal-documents-heading">
          Association documents
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          CC&Rs, bylaws, meeting minutes, and other documents shared with owners.
        </p>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-on-surface-variant">
            No documents have been shared yet. When your manager publishes a document to the portal it will appear here.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {documents.map((doc) => (
            <Card key={doc.id} data-testid={`portal-documents-row-${doc.id}`}>
              <CardContent className="space-y-3 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{doc.title ?? "Untitled document"}</p>
                    <p className="text-xs text-on-surface-variant">
                      {doc.documentType ? doc.documentType.replace(/-/g, " ") : "document"} ·{" "}
                      {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  {doc.documentType ? (
                    <Badge variant="outline" className="capitalize">
                      {doc.documentType.replace(/-/g, " ")}
                    </Badge>
                  ) : null}
                </div>
                {doc.fileUrl ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadDocument(doc)}
                    data-testid={`portal-documents-download-${doc.id}`}
                  >
                    Download
                  </Button>
                ) : (
                  <p className="text-xs text-on-surface-variant">No file attached.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PortalDocumentsPage() {
  useDocumentTitle("Documents");
  return (
    <PortalShell>
      <DocumentsContent />
    </PortalShell>
  );
}

export { DocumentsContent };
