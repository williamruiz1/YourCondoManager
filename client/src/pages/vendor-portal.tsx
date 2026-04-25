import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/error-state";

// ─── Types ────────────────────────────────────────────────────────────────────

type VendorPortalSession = {
  vendorPortalCredentialId: string;
  vendorId: string;
  associationId: string;
  email: string;
};

type WorkOrderStatus = "open" | "assigned" | "in-progress" | "pending-review" | "closed" | "cancelled";
type WorkOrderPriority = "low" | "medium" | "high" | "urgent";

type VendorActivity = {
  id: string;
  workOrderId: string;
  vendorId: string;
  activityType: "status_change" | "note_added" | "photo_uploaded" | "invoice_uploaded" | "estimated_completion_set";
  note: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  fileUrl: string | null;
  fileType: string | null;
  createdAt: string;
};

type WorkOrderDetail = {
  id: string;
  title: string;
  description: string;
  locationText: string | null;
  category: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assignedTo: string | null;
  estimatedCost: number | null;
  scheduledFor: string | null;
  resolutionNotes: string | null;
  photosJson: Array<{ url: string; label: string; type: string; uploadedAt: string }>;
  vendorEstimatedCompletionDate: string | null;
  vendorNotes: string | null;
  createdAt: string;
  updatedAt: string;
  activity: VendorActivity[];
  unit: { unitNumber: string; building: string | null } | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function vendorApiRequest(method: string, path: string, session: VendorPortalSession, body?: unknown) {
  return fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-vendor-portal-credential-id": session.vendorPortalCredentialId,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function statusBadgeClass(status: WorkOrderStatus): string {
  switch (status) {
    case "open": return "bg-slate-100 text-slate-700";
    case "assigned": return "bg-blue-100 text-blue-700";
    case "in-progress": return "bg-amber-100 text-amber-700";
    case "pending-review": return "bg-purple-100 text-purple-700";
    case "closed": return "bg-green-100 text-green-700";
    case "cancelled": return "bg-red-100 text-red-700";
    default: return "bg-slate-100 text-slate-700";
  }
}

function priorityBadgeClass(priority: WorkOrderPriority): string {
  switch (priority) {
    case "urgent": return "bg-red-100 text-red-700";
    case "high": return "bg-orange-100 text-orange-700";
    case "medium": return "bg-yellow-100 text-yellow-700";
    case "low": return "bg-slate-100 text-slate-600";
    default: return "bg-slate-100 text-slate-600";
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function activityIcon(type: VendorActivity["activityType"]): string {
  switch (type) {
    case "status_change": return "sync";
    case "note_added": return "chat";
    case "photo_uploaded": return "photo_camera";
    case "invoice_uploaded": return "receipt";
    case "estimated_completion_set": return "event";
    default: return "circle";
  }
}

function activityLabel(type: VendorActivity["activityType"]): string {
  switch (type) {
    case "status_change": return "Status updated";
    case "note_added": return "Note added";
    case "photo_uploaded": return "Photo uploaded";
    case "invoice_uploaded": return "Invoice submitted";
    case "estimated_completion_set": return "Est. completion set";
    default: return type;
  }
}

// ─── Login Screen ────────────────────────────────────────────────────────────

function VendorPortalLogin({ onLogin }: { onLogin: (session: VendorPortalSession) => void }) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [simulatedOtp, setSimulatedOtp] = useState<string | null>(null);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isLoadingVerify, setIsLoadingVerify] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const handleSendCode = async () => {
    if (!email.trim()) { setEmailError("Email is required"); return; }
    setIsLoadingEmail(true);
    setEmailError(null);
    try {
      const res = await fetch("/api/vendor-portal/request-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setEmailError(data.message || "Failed to send code"); return; }
      if (data.simulatedOtp) setSimulatedOtp(data.simulatedOtp);
      setOtp("");
      setStep("otp");
    } catch (err: any) {
      setEmailError(err.message || "An error occurred");
    } finally {
      setIsLoadingEmail(false);
    }
  };

  const handleVerify = async () => {
    if (!otp.trim() || otp.length !== 6) { setVerifyError("Please enter a valid 6-digit code"); return; }
    setIsLoadingVerify(true);
    setVerifyError(null);
    try {
      const res = await fetch("/api/vendor-portal/verify-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) { setVerifyError(data.message || "Verification failed"); return; }
      if (data.vendorPortalCredentialId) {
        onLogin(data as VendorPortalSession);
      }
    } catch (err: any) {
      setVerifyError(err.message || "An error occurred");
    } finally {
      setIsLoadingVerify(false);
    }
  };

  return (
    <div className="light min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-xl mb-4">
            <span className="material-symbols-outlined text-primary text-2xl">handyman</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Vendor Portal</h1>
          <p className="text-sm text-slate-500 mt-1">
            {step === "email" ? "Sign in with your registered email" : "Enter the code sent to your email"}
          </p>
        </div>

        {step === "email" && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSendCode(); }}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Email Address</label>
              <Input
                type="email"
                placeholder="contractor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoadingEmail}
                className="h-11"
              />
              {emailError && <p className="text-xs text-red-600 mt-1.5">{emailError}</p>}
            </div>
            <Button type="submit" disabled={isLoadingEmail || !email} className="w-full h-11">
              {isLoadingEmail ? "Sending..." : "Send Login Code"}
            </Button>
          </form>
        )}

        {step === "otp" && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleVerify(); }}>
            {simulatedOtp && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                <strong>Dev mode:</strong> Your code is <strong className="font-mono text-lg">{simulatedOtp}</strong>
              </div>
            )}
            <div>
              <p className="text-sm text-slate-500 mb-3">Code sent to <strong>{email}</strong></p>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">6-digit Code</label>
              <Input
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                className="font-mono text-center text-2xl tracking-widest h-14"
                disabled={isLoadingVerify}
              />
              {verifyError && <p className="text-xs text-red-600 mt-1.5">{verifyError}</p>}
            </div>
            <Button type="submit" disabled={isLoadingVerify || otp.length < 6} className="w-full h-11">
              {isLoadingVerify ? "Verifying..." : "Sign In"}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 text-xs" onClick={() => handleSendCode()} disabled={isLoadingEmail}>
                Resend Code
              </Button>
              <Button type="button" variant="outline" className="flex-1 text-xs" onClick={() => { setStep("email"); setOtp(""); setSimulatedOtp(null); setVerifyError(null); }}>
                Different Email
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Work Order Detail ───────────────────────────────────────────────────────

function WorkOrderDetail({
  workOrderId,
  session,
  onBack,
}: {
  workOrderId: string;
  session: VendorPortalSession;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);

  const [statusNote, setStatusNote] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [noteText, setNoteText] = useState("");
  const [estDate, setEstDate] = useState("");
  const [photoLabel, setPhotoLabel] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");

  const { data: wo, isLoading } = useQuery<WorkOrderDetail>({
    queryKey: ["/api/vendor-portal/work-orders", workOrderId],
    queryFn: async () => {
      const res = await vendorApiRequest("GET", `/api/vendor-portal/work-orders/${workOrderId}`, session);
      if (res.status === 403) { onBack(); throw new Error("Session expired or access denied"); }
      if (!res.ok) throw new Error("Failed to load work order");
      return res.json();
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/vendor-portal/work-orders", workOrderId] });

  const updateStatusMutation = useMutation({
    mutationFn: async () => {
      const res = await vendorApiRequest("PATCH", `/api/vendor-portal/work-orders/${workOrderId}/status`, session, { status: selectedStatus, note: statusNote });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => { setStatusNote(""); setSelectedStatus(""); invalidate(); qc.invalidateQueries({ queryKey: ["/api/vendor-portal/work-orders"] }); },
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const res = await vendorApiRequest("POST", `/api/vendor-portal/work-orders/${workOrderId}/notes`, session, { note: noteText });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => { setNoteText(""); invalidate(); },
  });

  const setEstDateMutation = useMutation({
    mutationFn: async () => {
      const res = await vendorApiRequest("PATCH", `/api/vendor-portal/work-orders/${workOrderId}/estimated-completion`, session, { estimatedCompletionDate: estDate });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => { setEstDate(""); invalidate(); },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      if (photoLabel) form.append("label", photoLabel);
      const res = await fetch(`/api/vendor-portal/work-orders/${workOrderId}/photos`, {
        method: "POST",
        headers: { "x-vendor-portal-credential-id": session.vendorPortalCredentialId },
        body: form,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => { setPhotoLabel(""); invalidate(); },
  });

  const uploadInvoiceMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      if (invoiceNumber) form.append("invoiceNumber", invoiceNumber);
      if (invoiceAmount) form.append("amount", invoiceAmount);
      if (invoiceDate) form.append("invoiceDate", invoiceDate);
      const res = await fetch(`/api/vendor-portal/work-orders/${workOrderId}/invoice`, {
        method: "POST",
        headers: { "x-vendor-portal-credential-id": session.vendorPortalCredentialId },
        body: form,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => { setInvoiceNumber(""); setInvoiceAmount(""); setInvoiceDate(""); invalidate(); },
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
      </div>
    );
  }
  if (!wo) return <div className="p-8 text-center text-slate-500">Work order not found.</div>;

  const vendorStatuses = [
    { value: "assigned", label: "Accepted" },
    { value: "in-progress", label: "In Progress" },
    { value: "pending-review", label: "Completed" },
    { value: "closed", label: "Closed" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <span className="material-symbols-outlined text-slate-600">arrow_back</span>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-slate-900 text-sm truncate">{wo.title}</h1>
          <p className="text-xs text-slate-500">{wo.unit ? `Unit ${wo.unit.unitNumber}${wo.unit.building ? ` · Bldg ${wo.unit.building}` : ""}` : wo.locationText || "No location"}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${statusBadgeClass(wo.status)}`}>
          {wo.status.replace("-", " ")}
        </span>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Details card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${priorityBadgeClass(wo.priority)}`}>{wo.priority}</span>
            <span className="text-xs text-slate-400 capitalize">{wo.category}</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{wo.description}</p>
          {wo.locationText && (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">location_on</span>{wo.locationText}
            </p>
          )}
          {wo.scheduledFor && (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">calendar_today</span>Scheduled: {formatDate(wo.scheduledFor)}
            </p>
          )}
          {wo.vendorEstimatedCompletionDate && (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">event_available</span>Est. completion: {formatDate(wo.vendorEstimatedCompletionDate)}
            </p>
          )}
        </div>

        {/* Update Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h2 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-primary">sync</span>Update Status
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {vendorStatuses.map((s) => (
              <button
                key={s.value}
                onClick={() => setSelectedStatus(selectedStatus === s.value ? "" : s.value)}
                className={`p-2.5 rounded-lg border text-xs font-semibold transition-colors ${selectedStatus === s.value ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {selectedStatus && (
            <>
              <Textarea
                placeholder="Briefly describe the update (required)..."
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                rows={2}
                className="text-sm"
              />
              {updateStatusMutation.isError && (
                <p className="text-xs text-red-600">{(updateStatusMutation.error as Error).message}</p>
              )}
              <Button size="sm" onClick={() => updateStatusMutation.mutate()} disabled={!statusNote.trim() || updateStatusMutation.isPending} className="w-full">
                {updateStatusMutation.isPending ? "Updating..." : "Submit Status Update"}
              </Button>
            </>
          )}
        </div>

        {/* Add Note */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h2 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-primary">chat</span>Add Note
          </h2>
          <Textarea
            placeholder="Parts ordered, follow-up needed, access notes..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={2}
            className="text-sm"
          />
          {addNoteMutation.isError && <p className="text-xs text-red-600">{(addNoteMutation.error as Error).message}</p>}
          <Button size="sm" onClick={() => addNoteMutation.mutate()} disabled={!noteText.trim() || addNoteMutation.isPending} className="w-full" variant="outline">
            {addNoteMutation.isPending ? "Saving..." : "Save Note"}
          </Button>
        </div>

        {/* Estimated Completion */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h2 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-primary">event</span>Estimated Completion Date
          </h2>
          <div className="flex gap-2">
            <Input type="date" value={estDate} onChange={(e) => setEstDate(e.target.value)} className="flex-1 text-sm h-9" />
            <Button size="sm" onClick={() => setEstDateMutation.mutate()} disabled={!estDate || setEstDateMutation.isPending} variant="outline">
              {setEstDateMutation.isPending ? "..." : "Set"}
            </Button>
          </div>
        </div>

        {/* Upload Photo */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h2 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-primary">photo_camera</span>Upload Completion Photo
          </h2>
          <Input
            type="text"
            placeholder="Photo label (optional)"
            value={photoLabel}
            onChange={(e) => setPhotoLabel(e.target.value)}
            className="text-sm h-9"
          />
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadPhotoMutation.mutate(file); e.target.value = ""; }}
          />
          {uploadPhotoMutation.isError && <p className="text-xs text-red-600">{(uploadPhotoMutation.error as Error).message}</p>}
          <Button size="sm" onClick={() => photoInputRef.current?.click()} disabled={uploadPhotoMutation.isPending} variant="outline" className="w-full">
            <span className="material-symbols-outlined text-sm mr-1">upload</span>
            {uploadPhotoMutation.isPending ? "Uploading..." : "Choose Photo"}
          </Button>
          {wo.photosJson.filter((p) => (p as any).uploadedByVendor).length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {wo.photosJson.filter((p) => (p as any).uploadedByVendor).map((photo, i) => (
                <a key={i} href={photo.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">{photo.label}</a>
              ))}
            </div>
          )}
        </div>

        {/* Submit Invoice */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h2 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-primary">receipt</span>Submit Invoice
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Invoice #" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="text-sm h-9" />
            <Input type="number" placeholder="Amount ($)" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} className="text-sm h-9" />
          </div>
          <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="text-sm h-9" />
          <input
            ref={invoiceInputRef}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadInvoiceMutation.mutate(file); e.target.value = ""; }}
          />
          {uploadInvoiceMutation.isError && <p className="text-xs text-red-600">{(uploadInvoiceMutation.error as Error).message}</p>}
          {uploadInvoiceMutation.isSuccess && <p className="text-xs text-green-600">Invoice submitted successfully.</p>}
          <Button size="sm" onClick={() => invoiceInputRef.current?.click()} disabled={uploadInvoiceMutation.isPending} variant="outline" className="w-full">
            <span className="material-symbols-outlined text-sm mr-1">upload_file</span>
            {uploadInvoiceMutation.isPending ? "Uploading..." : "Upload Invoice PDF/Image"}
          </Button>
        </div>

        {/* Activity Feed */}
        {wo.activity.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-primary">history</span>Activity
            </h2>
            <ol className="space-y-3">
              {[...wo.activity].reverse().map((item) => (
                <li key={item.id} className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-sm text-slate-500">{activityIcon(item.activityType)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700">{activityLabel(item.activityType)}</p>
                    {item.note && <p className="text-xs text-slate-500 mt-0.5">{item.note}</p>}
                    <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(item.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Work Order List ──────────────────────────────────────────────────────────

function VendorWorkOrderList({
  session,
  onLogout,
  onSelectWorkOrder,
}: {
  session: VendorPortalSession;
  onLogout: () => void;
  onSelectWorkOrder: (id: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const { data: workOrders = [], isLoading, isError, error: workOrdersError, refetch: refetchWorkOrders } = useQuery<WorkOrderDetail[]>({
    queryKey: ["/api/vendor-portal/work-orders"],
    queryFn: async () => {
      const res = await vendorApiRequest("GET", "/api/vendor-portal/work-orders", session);
      if (res.status === 403) { onLogout(); throw new Error("Session expired"); }
      if (!res.ok) throw new Error("Failed to load work orders");
      return res.json();
    },
  });

  const { data: me } = useQuery({
    queryKey: ["/api/vendor-portal/me"],
    queryFn: async () => {
      const res = await vendorApiRequest("GET", "/api/vendor-portal/me", session);
      if (res.status === 403) { onLogout(); throw new Error("Session expired"); }
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
  });

  const filtered = workOrders.filter((wo) => {
    if (statusFilter === "active") return wo.status !== "closed" && wo.status !== "cancelled";
    if (statusFilter === "completed") return wo.status === "closed" || wo.status === "pending-review";
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">handyman</span>
          <div>
            <h1 className="font-semibold text-slate-900 text-sm">Work Orders</h1>
            {me?.vendor && <p className="text-xs text-slate-500">{me.vendor.name}</p>}
          </div>
        </div>
        <button
          onClick={onLogout}
          className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">logout</span>Sign out
        </button>
      </div>

      {/* Filter tabs */}
      <div className="bg-white border-b border-slate-200 px-4 flex gap-4">
        {[
          { value: "active", label: "Active" },
          { value: "completed", label: "Completed" },
          { value: "all", label: "All" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`py-2.5 text-xs font-semibold border-b-2 transition-colors ${statusFilter === f.value ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {f.label}
            {f.value === "active" && workOrders.filter((wo) => wo.status !== "closed" && wo.status !== "cancelled").length > 0 && (
              <span className="ml-1.5 bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full">
                {workOrders.filter((wo) => wo.status !== "closed" && wo.status !== "cancelled").length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {isLoading && (
          <div className="py-16 text-center text-slate-400">
            <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
          </div>
        )}

        {!isLoading && isError && (
          <ErrorState
            title="Couldn't load work orders"
            description="We hit an error loading your assigned work orders. Try again, or sign out and back in if the problem persists."
            retry={() => refetchWorkOrders()}
            details={(workOrdersError as Error | undefined)?.message}
            testId="vendor-portal-work-orders-error"
          />
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="py-16 text-center text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">check_circle</span>
            <p className="text-sm">No work orders to show.</p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((wo) => (
            <button
              key={wo.id}
              onClick={() => onSelectWorkOrder(wo.id)}
              className="w-full bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-sm text-slate-900 leading-tight">{wo.title}</h3>
                <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${statusBadgeClass(wo.status)}`}>
                  {wo.status.replace("-", " ")}
                </span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-2 mb-2">{wo.description}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded capitalize ${priorityBadgeClass(wo.priority)}`}>{wo.priority}</span>
                {wo.unit && (
                  <span className="text-xs text-slate-400">Unit {wo.unit.unitNumber}</span>
                )}
                {wo.vendorEstimatedCompletionDate && (
                  <span className="text-xs text-slate-400 flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-xs">event</span>Est. {formatDate(wo.vendorEstimatedCompletionDate)}
                  </span>
                )}
                <span className="text-xs text-slate-400 ml-auto">Updated {formatDate(wo.updatedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const SESSION_STORAGE_KEY = "vendor_portal_session";

export default function VendorPortalPage() {
  const [session, setSession] = useState<VendorPortalSession | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);

  const handleLogin = (s: VendorPortalSession) => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(s));
    setSession(s);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    setSelectedWorkOrderId(null);
  };

  if (!session) {
    return <VendorPortalLogin onLogin={handleLogin} />;
  }

  if (selectedWorkOrderId) {
    return (
      <WorkOrderDetail
        workOrderId={selectedWorkOrderId}
        session={session}
        onBack={() => setSelectedWorkOrderId(null)}
      />
    );
  }

  return (
    <VendorWorkOrderList
      session={session}
      onLogout={handleLogout}
      onSelectWorkOrder={setSelectedWorkOrderId}
    />
  );
}
