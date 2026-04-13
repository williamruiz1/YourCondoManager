import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { financeSubPages } from "@/lib/sub-page-nav";
import { useAssociationContext } from "@/context/association-context";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { useIsMobile } from "@/hooks/use-mobile";
import type { OwnerPaymentLink, PaymentGatewayConnection, PaymentMethodConfig, PartialPaymentRule, Person, Unit } from "@shared/schema";
import {
  CreditCard,
  Zap,
  Link2,
  Webhook,
  CheckCircle2,
  AlertCircle,
  Copy,
  Info,
  Shield,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Link } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// ── Payment Methods Tab ───────────────────────────────────────────────────────

const METHOD_TYPE_OPTIONS = [
  { value: "bank-transfer", label: "Bank Transfer (ACH/Wire)" },
  { value: "bill-pay", label: "Online Bill Pay" },
  { value: "check", label: "Check / Money Order" },
  { value: "zelle", label: "Zelle" },
  { value: "other", label: "Other" },
];

function PaymentMethodsTab({
  associationId,
  paymentMethods,
  isLoading,
  onSaved,
}: {
  associationId: string | null;
  paymentMethods: PaymentMethodConfig[];
  isLoading: boolean;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    methodType: "bank-transfer",
    displayName: "",
    instructions: "",
    accountName: "",
    bankName: "",
    routingNumber: "",
    accountNumber: "",
    mailingAddress: "",
    paymentNotes: "",
    zelleHandle: "",
    supportEmail: "",
    supportPhone: "",
    displayOrder: 0,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!associationId) throw new Error("Select an association first");
      if (!form.displayName.trim() || !form.instructions.trim()) {
        throw new Error("Display name and instructions are required");
      }
      const res = await apiRequest("POST", "/api/financial/payment-methods", {
        associationId,
        methodType: form.methodType,
        displayName: form.displayName.trim(),
        instructions: form.instructions.trim(),
        accountName: form.accountName.trim() || null,
        bankName: form.bankName.trim() || null,
        routingNumber: form.routingNumber.trim() || null,
        accountNumber: form.accountNumber.trim() || null,
        mailingAddress: form.mailingAddress.trim() || null,
        paymentNotes: form.paymentNotes.trim() || null,
        zelleHandle: form.zelleHandle.trim() || null,
        supportEmail: form.supportEmail.trim() || null,
        supportPhone: form.supportPhone.trim() || null,
        isActive: 1,
        displayOrder: Number(form.displayOrder) || 0,
      });
      return res.json();
    },
    onSuccess: () => {
      setForm({
        methodType: "bank-transfer",
        displayName: "",
        instructions: "",
        accountName: "",
        bankName: "",
        routingNumber: "",
        accountNumber: "",
        mailingAddress: "",
        paymentNotes: "",
        zelleHandle: "",
        supportEmail: "",
        supportPhone: "",
        displayOrder: 0,
      });
      onSaved();
      toast({ title: "Payment method saved" });
    },
    onError: (err: Error) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const showBankFields = form.methodType === "bank-transfer";
  const showZelleFields = form.methodType === "zelle";
  const showMailingFields = form.methodType === "check";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/20 p-4 flex gap-3">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Payment methods tell owners <strong>how to pay</strong> their HOA dues. These appear in payment
          notices and in the owner portal. Add one method per payment channel (e.g., one for bank transfer,
          one for Zelle). A Stripe gateway connection is only required if you want owners to pay online
          via ACH bank account debit — configure that in the Gateway tab.
        </p>
      </div>

      {/* Existing methods */}
      {isLoading ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Configured methods</p>
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="rounded-lg border p-3">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-4 w-full animate-pulse rounded bg-muted" />
                <div className="mt-2 h-4 w-32 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ) : paymentMethods.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Configured methods ({paymentMethods.length})</p>
          {paymentMethods.map((m) => (
            <div key={m.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start">
              <Badge variant="secondary" className="shrink-0 self-start">{m.methodType}</Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{m.displayName}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{m.instructions}</p>
              </div>
              <Badge variant={m.isActive === 1 ? "default" : "secondary"} className="shrink-0 self-start">
                {m.isActive === 1 ? "Active" : "Inactive"}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Add payment method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.methodType} onValueChange={(v) => setForm((p) => ({ ...p, methodType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHOD_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Display name <span className="text-muted-foreground font-normal text-xs">(shown to owners)</span></Label>
              <Input
                placeholder="e.g. Direct Bank Transfer"
                value={form.displayName}
                onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
              />
            </div>
          </div>

          {showBankFields && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Account name</Label>
                <Input placeholder="Maple Heights HOA" value={form.accountName} onChange={(e) => setForm((p) => ({ ...p, accountName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Bank name</Label>
                <Input placeholder="First National Bank" value={form.bankName} onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Routing number</Label>
                <Input placeholder="021000021" value={form.routingNumber} onChange={(e) => setForm((p) => ({ ...p, routingNumber: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Account number</Label>
                <Input placeholder="••••••1234" value={form.accountNumber} onChange={(e) => setForm((p) => ({ ...p, accountNumber: e.target.value }))} />
              </div>
            </div>
          )}

          {showZelleFields && (
            <div className="space-y-1.5">
              <Label>Zelle handle <span className="text-muted-foreground font-normal text-xs">(email or phone registered with Zelle)</span></Label>
              <Input placeholder="treasurer@maplehoa.org" value={form.zelleHandle} onChange={(e) => setForm((p) => ({ ...p, zelleHandle: e.target.value }))} />
            </div>
          )}

          {showMailingFields && (
            <div className="space-y-1.5">
              <Label>Mailing address for checks</Label>
              <Textarea
                placeholder="Maple Heights HOA&#10;P.O. Box 1234&#10;Springfield, IL 62701"
                rows={3}
                value={form.mailingAddress}
                onChange={(e) => setForm((p) => ({ ...p, mailingAddress: e.target.value }))}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Instructions for owners <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Please include your unit number and the payment period in the memo line."
              rows={3}
              value={form.instructions}
              onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Support email <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input placeholder="payments@maplehoa.org" value={form.supportEmail} onChange={(e) => setForm((p) => ({ ...p, supportEmail: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Support phone <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input placeholder="(555) 555-1234" value={form.supportPhone} onChange={(e) => setForm((p) => ({ ...p, supportPhone: e.target.value }))} />
            </div>
          </div>

          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !associationId}
          >
            {createMutation.isPending ? "Saving…" : "Save Payment Method"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Gateway Tab ───────────────────────────────────────────────────────────────

function GatewayTab({
  associationId,
  gatewayConnections,
  isLoading,
  onSaved,
}: {
  associationId: string | null;
  gatewayConnections: PaymentGatewayConnection[];
  isLoading: boolean;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    provider: "stripe" as "stripe" | "other",
    providerAccountId: "",
    publishableKey: "",
    secretKey: "",
    webhookSecret: "",
    isActive: true,
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      if (!associationId) throw new Error("Select an association first");
      const res = await apiRequest("POST", "/api/financial/payment-gateway/validate", {
        associationId,
        provider: form.provider,
        providerAccountId: form.providerAccountId.trim() || null,
        publishableKey: form.publishableKey.trim() || null,
        secretKey: form.secretKey.trim() || null,
        webhookSecret: form.webhookSecret.trim() || null,
        isActive: form.isActive,
      });
      return res.json() as Promise<{ validated: boolean; checks: string[] }>;
    },
    onSuccess: (result) => {
      setForm((p) => ({ ...p, secretKey: "", webhookSecret: "" }));
      onSaved();
      toast({ title: "Gateway connected", description: result.checks.join(" ") });
    },
    onError: (err: Error) => toast({ title: "Connection failed", description: err.message, variant: "destructive" }),
  });

  const activeConnections = gatewayConnections.filter((c) => c.isActive === 1);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/20 p-4 flex gap-3">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            A gateway connection is <strong>optional</strong> and only required if you want owners to pay
            online via ACH bank debit. Most self-managed associations use bank transfer or Zelle instead —
            configure those in the Payment Methods tab.
          </p>
          <p>
            To connect Stripe: log in to your Stripe Dashboard, go to{" "}
            <strong>Developers → API keys</strong>, and copy your publishable and secret keys.
            The webhook secret is found under <strong>Developers → Webhooks</strong> after creating an endpoint.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Active connections</p>
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="rounded-lg border p-3">
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-4 w-40 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ) : activeConnections.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Active connections ({activeConnections.length})</p>
          {activeConnections.map((c) => (
            <div key={c.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium capitalize">{c.provider}</p>
                {c.providerAccountId && (
                  <p className="text-xs text-muted-foreground">Account: {c.providerAccountId}</p>
                )}
              </div>
              <Badge variant="default">Active</Badge>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Connect a payment gateway</CardTitle>
          <CardDescription>Keys are stored encrypted and the secret key is never displayed again after saving.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Gateway provider</Label>
            <Select
              value={form.provider}
              onValueChange={(v) => setForm((p) => ({ ...p, provider: v as "stripe" | "other" }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>
              Publishable key{" "}
              <span className="text-muted-foreground font-normal text-xs">(starts with pk_)</span>
            </Label>
            <Input
              placeholder="pk_live_..."
              value={form.publishableKey}
              onChange={(e) => setForm((p) => ({ ...p, publishableKey: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Secret key{" "}
              <span className="text-muted-foreground font-normal text-xs">(starts with sk_ — never share this)</span>
            </Label>
            <Input
              type="password"
              placeholder="sk_live_..."
              value={form.secretKey}
              onChange={(e) => setForm((p) => ({ ...p, secretKey: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Webhook signing secret{" "}
              <span className="text-muted-foreground font-normal text-xs">(starts with whsec_)</span>
            </Label>
            <Input
              type="password"
              placeholder="whsec_..."
              value={form.webhookSecret}
              onChange={(e) => setForm((p) => ({ ...p, webhookSecret: e.target.value }))}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="gateway-active"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
            />
            <Label htmlFor="gateway-active" className="font-normal cursor-pointer">Enable this connection immediately</Label>
          </div>

          <Button
            onClick={() => validateMutation.mutate()}
            disabled={validateMutation.isPending || !associationId}
          >
            {validateMutation.isPending ? "Validating…" : "Validate & Save Connection"}
          </Button>
          {validateMutation.isError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Check that your API keys are correct and the Stripe account is active.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Payment Links Tab ─────────────────────────────────────────────────────────

function PaymentLinksTab({
  associationId,
  persons,
  units,
  isLoadingPeople,
  isLoadingUnits,
}: {
  associationId: string | null;
  persons: Person[];
  units: Unit[];
  isLoadingPeople: boolean;
  isLoadingUnits: boolean;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    unitId: "",
    personId: "",
    amount: "",
    currency: "USD",
    allowPartial: false,
    memo: "",
    expiresAt: "",
  });
  const [lastLink, setLastLink] = useState<{
    link: OwnerPaymentLink;
    paymentUrl: string;
    outstandingBalance: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const filteredUnits = units.filter(
    (u) => !associationId || u.associationId === associationId,
  );

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!associationId || !form.unitId || !form.personId) {
        throw new Error("Select an association, unit, and person");
      }
      const amount = form.amount.trim() ? Number(form.amount) : null;
      if (form.amount.trim() && (!Number.isFinite(amount) || (amount as number) <= 0)) {
        throw new Error("Amount must be a positive number, or leave blank to use the outstanding balance");
      }
      const res = await apiRequest("POST", "/api/financial/owner-payment-links", {
        associationId,
        unitId: form.unitId,
        personId: form.personId,
        amount,
        currency: form.currency || "USD",
        allowPartial: form.allowPartial,
        memo: form.memo.trim() || null,
        expiresAt: form.expiresAt || null,
      });
      return res.json() as Promise<{ link: OwnerPaymentLink; paymentUrl: string; outstandingBalance: number }>;
    },
    onSuccess: (result) => {
      setLastLink(result);
      toast({ title: "Payment link generated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleCopy = async () => {
    if (!lastLink) return;
    await navigator.clipboard.writeText(lastLink.paymentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/20 p-4 flex gap-3">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Generate a unique payment link for a specific owner. Copy the link and paste it into a payment
          notice or email. The owner visits the link to see their balance and pay. Links require a gateway
          connection for online ACH payments — for manual payment methods, this link shows instructions
          instead.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Generate a payment link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={form.unitId || "_"} onValueChange={(v) => setForm((p) => ({ ...p, unitId: v === "_" ? "" : v }))}>
                <SelectTrigger disabled={isLoadingUnits}><SelectValue placeholder={isLoadingUnits ? "Loading units..." : "Select unit"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">Select unit</SelectItem>
                  {filteredUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.unitNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={form.personId || "_"} onValueChange={(v) => setForm((p) => ({ ...p, personId: v === "_" ? "" : v }))}>
                <SelectTrigger disabled={isLoadingPeople}><SelectValue placeholder={isLoadingPeople ? "Loading owners..." : "Select owner"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">Select owner</SelectItem>
                  {persons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                Amount{" "}
                <span className="text-muted-foreground font-normal text-xs">(blank = full outstanding balance)</span>
              </Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="350.00"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Memo <span className="text-muted-foreground font-normal text-xs">(optional — appears on the payment page)</span></Label>
            <Input
              placeholder="January 2026 HOA dues"
              value={form.memo}
              onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="allow-partial"
              type="checkbox"
              checked={form.allowPartial}
              onChange={(e) => setForm((p) => ({ ...p, allowPartial: e.target.checked }))}
            />
            <Label htmlFor="allow-partial" className="font-normal cursor-pointer">
              Allow partial payments
            </Label>
          </div>

          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || !associationId || isLoadingPeople || isLoadingUnits}
          >
            {generateMutation.isPending ? "Generating…" : "Generate Payment Link"}
          </Button>
          {(isLoadingPeople || isLoadingUnits) ? (
            <div className="text-xs text-muted-foreground">
              Loading owner and unit options for the selected association.
            </div>
          ) : null}

          {lastLink && (
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <p className="text-sm font-medium">Link generated</p>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Outstanding balance</p>
                <p className="text-sm font-semibold">${lastLink.outstandingBalance.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Payment URL — share this with the owner</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-2 py-1 text-xs break-all">
                    {lastLink.paymentUrl}
                  </code>
                  <Button size="sm" variant="outline" onClick={handleCopy}>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Webhook Monitor Tab ───────────────────────────────────────────────────────

function WebhookMonitorTab({
  associationId,
  persons,
  units,
}: {
  associationId: string | null;
  persons: Person[];
  units: Unit[];
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    provider: "stripe" as "stripe" | "other",
    providerEventId: "",
    eventType: "payment_intent.succeeded",
    status: "succeeded" as "succeeded" | "failed" | "pending",
    amount: "",
    currency: "USD",
    personId: "",
    unitId: "",
    paymentLinkToken: "",
    gatewayReference: "",
  });
  const [lastMessage, setLastMessage] = useState("");

  const filteredUnits = units.filter(
    (u) => !associationId || u.associationId === associationId,
  );

  const testMutation = useMutation({
    mutationFn: async () => {
      if (!associationId || !form.providerEventId.trim()) {
        throw new Error("Association and provider event ID are required");
      }
      const amount = form.amount.trim() ? Number(form.amount) : null;
      if (form.amount.trim() && !Number.isFinite(amount)) {
        throw new Error("Amount must be numeric");
      }
      const res = await apiRequest("POST", "/api/webhooks/payments", {
        associationId,
        provider: form.provider,
        providerEventId: form.providerEventId.trim(),
        eventType: form.eventType.trim() || null,
        status: form.status,
        amount,
        currency: form.currency || "USD",
        personId: form.personId.trim() || null,
        unitId: form.unitId.trim() || null,
        paymentLinkToken: form.paymentLinkToken.trim() || null,
        gatewayReference: form.gatewayReference.trim() || null,
      });
      return res.json() as Promise<{ message: string; duplicate: boolean }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/owner-ledger/entries"] });
      setLastMessage(result.message);
      toast({
        title: result.duplicate ? "Duplicate webhook replayed" : "Webhook processed",
        description: result.message,
      });
    },
    onError: (err: Error) => toast({ title: "Webhook test failed", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 p-4 flex gap-3">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          This tab is for <strong>developer testing only</strong>. In production, payment webhooks are
          delivered automatically by your gateway (e.g., Stripe) and do not need to be triggered here.
          Use this to simulate a payment event and verify that ledger entries are created correctly.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Simulate inbound payment webhook</CardTitle>
          <CardDescription>Creates a ledger entry as if a real payment was received.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Provider event ID <span className="text-muted-foreground font-normal text-xs">(any unique string for test)</span></Label>
              <Input
                placeholder="evt_test_12345"
                value={form.providerEventId}
                onChange={(e) => setForm((p) => ({ ...p, providerEventId: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={(v) => setForm((p) => ({ ...p, provider: v as "stripe" | "other" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as typeof form.status }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="succeeded">Succeeded</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input placeholder="350.00" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={form.unitId || "_"} onValueChange={(v) => setForm((p) => ({ ...p, unitId: v === "_" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">None</SelectItem>
                  {filteredUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.unitNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={form.personId || "_"} onValueChange={(v) => setForm((p) => ({ ...p, personId: v === "_" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">None</SelectItem>
                  {persons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Payment link token <span className="text-muted-foreground font-normal text-xs">(from Payment Links tab)</span></Label>
            <Input
              placeholder="Paste token from a generated payment link"
              value={form.paymentLinkToken}
              onChange={(e) => setForm((p) => ({ ...p, paymentLinkToken: e.target.value }))}
            />
          </div>

          <Button
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || !associationId}
            variant="secondary"
          >
            {testMutation.isPending ? "Sending…" : "Send Test Webhook"}
          </Button>

          {lastMessage && (
            <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              <strong>Result:</strong> {lastMessage}
            </div>
          )}
        </CardContent>
      </Card>

      <WebhookSecurityCard associationId={associationId} />
      <PaymentEventStateCard associationId={associationId} />
    </div>
  );
}

// ── Webhook Security Card ─────────────────────────────────────────────────────
function WebhookSecurityCard({ associationId }: { associationId: string | null }) {
  const { toast } = useToast();
  const [secretInput, setSecretInput] = useState("");
  const [provider, setProvider] = useState("generic");

  const { data: secrets = [], refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/webhook-secrets", associationId],
    queryFn: async () => {
      if (!associationId) return [];
      const res = await apiRequest("GET", `/api/admin/webhook-secrets?associationId=${associationId}`);
      return res.json();
    },
    enabled: Boolean(associationId),
  });

  const createSecret = useMutation({
    mutationFn: async () => {
      if (!associationId || !secretInput) throw new Error("Secret is required");
      if (secretInput.length < 16) throw new Error("Secret must be at least 16 characters");
      const res = await apiRequest("POST", "/api/admin/webhook-secrets", {
        associationId,
        plainSecret: secretInput,
        provider,
      });
      return res.json();
    },
    onSuccess: async () => {
      setSecretInput("");
      await refetch();
      toast({ title: "Webhook signing secret saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4 text-green-600" /> Webhook Signing Secrets
        </CardTitle>
        <CardDescription>Store HMAC-SHA256 signing keys. Incoming webhook requests include an <code>x-webhook-hmac-sha256</code> header to authenticate payloads.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {secrets.length > 0 && (
          <div className="space-y-2">
            {secrets.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span className="font-mono">{s.secretHint}</span>
                <div className="flex gap-2 items-center">
                  <Badge variant="outline">{s.provider}</Badge>
                  <Badge variant={s.isActive ? "default" : "secondary"}>{s.isActive ? "Active" : "Rotated"}</Badge>
                  {s.rotatedAt && <span className="text-xs text-muted-foreground">Rotated {new Date(s.rotatedAt).toLocaleDateString()}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Input
              type="password"
              placeholder="New signing secret (min 16 chars)"
              value={secretInput}
              onChange={e => setSecretInput(e.target.value)}
            />
          </div>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="generic">Generic</SelectItem>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="square">Square</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={() => createSecret.mutate()}
          disabled={!associationId || !secretInput || createSecret.isPending}
        >
          {createSecret.isPending ? "Saving…" : "Save Secret"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Payment Event State Card ──────────────────────────────────────────────────
function PaymentEventStateCard({ associationId }: { associationId: string | null }) {
  const { toast } = useToast();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<"received" | "processed" | "ignored" | "failed">("processed");
  const [reason, setReason] = useState("");

  const { data: events = [], refetch: refetchEvents } = useQuery<any[]>({
    queryKey: ["/api/admin/payment-events", associationId],
    queryFn: async () => {
      if (!associationId) return [];
      const res = await apiRequest("GET", `/api/admin/payment-events?associationId=${associationId}`);
      return res.json();
    },
    enabled: Boolean(associationId),
  });

  const { data: transitions = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/payment-events/transitions", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const res = await apiRequest("GET", `/api/admin/payment-events/${selectedEventId}/transitions`);
      return res.json();
    },
    enabled: Boolean(selectedEventId),
  });

  const forceTransition = useMutation({
    mutationFn: async () => {
      if (!selectedEventId) throw new Error("Select an event");
      const res = await apiRequest("PATCH", `/api/admin/payment-events/${selectedEventId}/status`, { status: newStatus, reason });
      return res.json();
    },
    onSuccess: async () => {
      await refetchEvents();
      setReason("");
      toast({ title: "Status updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (events.length === 0) return null;

  const statusColors: Record<string, string> = {
    received: "secondary",
    processed: "default",
    ignored: "outline",
    failed: "destructive",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Payment Event States</CardTitle>
        <CardDescription>Review and force-transition webhook payment event states. Select an event to view its state history.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Selected Event</div>
          <div className="mt-1 text-sm font-medium">
            {selectedEventId ? `${events.find((event: any) => event.id === selectedEventId)?.providerEventId?.slice(0, 20) || selectedEventId.slice(0, 12)}` : "Choose an event below"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {selectedEventId ? "Review its state history and apply a manual transition only when reconciliation requires it." : "Start by selecting a payment event from the queue."}
          </div>
        </div>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event ID</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Select</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.slice(0, 20).map((e: any) => (
                <TableRow key={e.id} className={selectedEventId === e.id ? "bg-muted/30" : ""}>
                  <TableCell className="font-mono text-xs">{e.providerEventId?.slice(0, 20)}</TableCell>
                  <TableCell className="text-xs capitalize">{e.provider}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.eventType ?? "—"}</TableCell>
                  <TableCell className="text-sm">{e.amount != null ? `$${e.amount.toFixed(2)}` : "—"}</TableCell>
                  <TableCell><Badge variant={(statusColors[e.status] ?? "outline") as any}>{e.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSelectedEventId(prev => prev === e.id ? null : e.id)}>
                      {selectedEventId === e.id ? "Deselect" : "Select"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="space-y-3 md:hidden">
          {events.slice(0, 20).map((e: any) => (
            <div key={e.id} className={`rounded-xl border p-4 space-y-3 ${selectedEventId === e.id ? "bg-muted/30" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs">{e.providerEventId?.slice(0, 20) || e.id.slice(0, 12)}</div>
                  <div className="mt-1 text-xs text-muted-foreground capitalize">{e.provider} · {e.eventType ?? "—"}</div>
                </div>
                <Badge variant={(statusColors[e.status] ?? "outline") as any}>{e.status}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>{e.amount != null ? `$${e.amount.toFixed(2)}` : "—"}</span>
                <span className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              <Button className="w-full" size="sm" variant="outline" onClick={() => setSelectedEventId(prev => prev === e.id ? null : e.id)}>
                {selectedEventId === e.id ? "Deselect" : "Select"}
              </Button>
            </div>
          ))}
        </div>

        {selectedEventId && (
          <div className="rounded-md border p-3 space-y-3 bg-muted/20">
            <div className="text-sm font-medium">Force Status Transition</div>
            {transitions.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="font-medium text-foreground mb-1">State History:</div>
                {transitions.map((t: any, i: number) => (
                  <div key={i} className="rounded-md border bg-white px-3 py-2">
                    {t.fromStatus} → {t.toStatus} · {t.reason} · {new Date(t.transitionedAt).toLocaleString()}
                  </div>
                ))}
              </div>
            )}
            <div className={`gap-2 ${events.length > 0 ? "grid grid-cols-1 sm:grid-cols-[144px_minmax(0,1fr)_auto]" : "flex flex-col sm:flex-row"}`}>
              <Select value={newStatus} onValueChange={v => setNewStatus(v as typeof newStatus)}>
                <SelectTrigger className={events.length > 0 ? "min-h-11 sm:w-36" : "min-h-11"}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="received">received</SelectItem>
                  <SelectItem value="processed">processed</SelectItem>
                  <SelectItem value="ignored">ignored</SelectItem>
                  <SelectItem value="failed">failed</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Reason" value={reason} onChange={e => setReason(e.target.value)} className="min-h-11 flex-1" />
              <Button size="sm" className="min-h-11" onClick={() => forceTransition.mutate()} disabled={forceTransition.isPending}>Apply</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Payment Activity Tab ──────────────────────────────────────────────────────

type PaymentActivityStats = { totalPayments: number; totalCredits: number; totalAdjustments: number; last30DaysCount: number; last30DaysTotal: number };
type ActivityEntry = { id: string; entryType: string; amount: number; postedAt: string; description: string | null; unitId: string; personId: string };

function PaymentActivityTab({ associationId }: { associationId: string | null }) {
  const { data, isLoading } = useQuery<{ entries: ActivityEntry[]; stats: PaymentActivityStats }>({
    queryKey: ["/api/financial/payment-activity", associationId],
    queryFn: async () => {
      if (!associationId) return { entries: [], stats: { totalPayments: 0, totalCredits: 0, totalAdjustments: 0, last30DaysCount: 0, last30DaysTotal: 0 } };
      const res = await apiRequest("GET", `/api/financial/payment-activity?associationId=${associationId}`);
      return res.json();
    },
    enabled: Boolean(associationId),
  });

  const entries = data?.entries ?? [];
  const stats = data?.stats;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Payment Activity Summary</CardTitle></CardHeader>
        <CardContent>
          {stats && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {[
                { label: "Total Payments", value: `$${stats.totalPayments.toFixed(2)}` },
                { label: "Total Credits", value: `$${stats.totalCredits.toFixed(2)}` },
                { label: "Net Adjustments", value: `$${stats.totalAdjustments.toFixed(2)}` },
                { label: "Last 30 Days Count", value: stats.last30DaysCount },
                { label: "Last 30 Days Total", value: `$${stats.last30DaysTotal.toFixed(2)}` },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border bg-muted/20 p-3 text-center">
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Payment & Credit Entries</CardTitle><CardDescription>{entries.length} entries (payments, credits, adjustments)</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}</div>
          ) : entries.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">No payments recorded yet — configure payment methods above, then record the first owner payment to start tracking collections.</div>
          ) : (
            <>
              <div className="hidden md:block overflow-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-xs text-muted-foreground">{["Date", "Type", "Amount", "Unit", "Person", "Description"].map(h => <th key={h} className="text-left py-2 pr-4">{h}</th>)}</tr></thead>
                  <tbody>
                    {entries.slice().reverse().map((e) => (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="py-1.5 pr-4 text-muted-foreground">{new Date(e.postedAt).toLocaleDateString()}</td>
                        <td className="py-1.5 pr-4"><Badge variant={e.entryType === "payment" ? "default" : "secondary"} className="text-xs">{e.entryType}</Badge></td>
                        <td className={`py-1.5 pr-4 font-medium ${e.amount < 0 ? "text-green-600" : "text-red-500"}`}>{e.amount < 0 ? "-" : "+"}${Math.abs(e.amount).toFixed(2)}</td>
                        <td className="py-1.5 pr-4 font-mono text-xs">{e.unitId.slice(0, 8)}</td>
                        <td className="py-1.5 pr-4 font-mono text-xs">{e.personId.slice(0, 8)}</td>
                        <td className="py-1.5 text-muted-foreground truncate max-w-xs">{e.description ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 md:hidden">
                {entries.slice().reverse().map((e) => (
                  <div key={e.id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{e.description ?? "Payment activity"}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{new Date(e.postedAt).toLocaleDateString()}</div>
                      </div>
                      <div className={`text-sm font-semibold ${e.amount < 0 ? "text-green-600" : "text-red-500"}`}>
                        {e.amount < 0 ? "-" : "+"}${Math.abs(e.amount).toFixed(2)}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant={e.entryType === "payment" ? "default" : "secondary"} className="text-xs">{e.entryType}</Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">{e.unitId.slice(0, 8)}</Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">Person {e.personId.slice(0, 8)}</Badge>
                    </div>
                    {e.description ? (
                      <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                        {e.description}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Exceptions Review Tab ─────────────────────────────────────────────────────

type PaymentException = { id: string; entryId: string; type: string; description: string; amount: number; unitId: string; personId: string; postedAt: string };

function ExceptionsTab({ associationId }: { associationId: string | null }) {
  const { data: exceptions = [], isLoading } = useQuery<PaymentException[]>({
    queryKey: ["/api/financial/payment-exceptions", associationId],
    queryFn: async () => {
      if (!associationId) return [];
      const res = await apiRequest("GET", `/api/financial/payment-exceptions?associationId=${associationId}`);
      return res.json();
    },
    enabled: Boolean(associationId),
  });

  const exceptionTypeLabel: Record<string, string> = {
    large_payment: "Large Payment",
    negative_adjustment: "Negative Adjustment",
    duplicate_payment: "Duplicate Payment",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500" /> Exception Review
        </CardTitle>
        <CardDescription>Flagged transactions: large amounts, negative adjustments, and possible duplicates.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}</div>
        ) : exceptions.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-4 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" /> No exceptions found. All payment activity looks clean.
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs text-muted-foreground">{["Date", "Exception Type", "Amount", "Unit", "Person", "Description"].map(h => <th key={h} className="text-left py-2 pr-4">{h}</th>)}</tr></thead>
                <tbody>
                  {exceptions.map((ex) => (
                    <tr key={ex.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-4 text-muted-foreground">{new Date(ex.postedAt).toLocaleDateString()}</td>
                      <td className="py-1.5 pr-4">
                        <Badge variant="destructive" className="text-xs">{exceptionTypeLabel[ex.type] ?? ex.type}</Badge>
                      </td>
                      <td className="py-1.5 pr-4 font-medium text-red-500">${Math.abs(ex.amount).toFixed(2)}</td>
                      <td className="py-1.5 pr-4 font-mono text-xs">{ex.unitId.slice(0, 8)}</td>
                      <td className="py-1.5 pr-4 font-mono text-xs">{ex.personId.slice(0, 8)}</td>
                      <td className="py-1.5 text-muted-foreground">{ex.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {exceptions.map((ex) => (
                <div key={ex.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{ex.description}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{new Date(ex.postedAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-sm font-semibold text-red-500">${Math.abs(ex.amount).toFixed(2)}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="destructive" className="text-xs">{exceptionTypeLabel[ex.type] ?? ex.type}</Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">{ex.unitId.slice(0, 8)}</Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">Person {ex.personId.slice(0, 8)}</Badge>
                  </div>
                  <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    Entry {ex.entryId.slice(0, 8)} · Review whether this needs follow-up or reclassification.
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

// ── Autopay Admin Tab ─────────────────────────────────────────────────────────

type AutopayEnrollmentRow = {
  id: string;
  unitId: string;
  personId: string;
  amount: number;
  frequency: string;
  dayOfMonth: number | null;
  status: string;
  nextPaymentDate: string | null;
  description: string;
  enrolledAt: string;
  cancelledAt: string | null;
  unitNumber: string | null;
  building: string | null;
  personFirstName: string | null;
  personLastName: string | null;
  personEmail: string | null;
};

type AutopayRun = {
  id: string;
  enrollmentId: string;
  associationId: string;
  amount: number;
  status: string;
  errorMessage: string | null;
  ranAt: string;
};

function AutopayAdminTab({ associationId }: { associationId: string | null }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: enrollments = [], isLoading, refetch } = useQuery<AutopayEnrollmentRow[]>({
    queryKey: ["/api/financial/autopay/enrollments", associationId],
    queryFn: async () => {
      if (!associationId) return [];
      const res = await apiRequest("GET", `/api/financial/autopay/enrollments?associationId=${associationId}`);
      return res.json();
    },
    enabled: Boolean(associationId),
  });

  const { data: runs = [], isLoading: runsLoading } = useQuery<AutopayRun[]>({
    queryKey: ["/api/financial/autopay/enrollments/runs", expandedId],
    queryFn: async () => {
      if (!expandedId) return [];
      const res = await apiRequest("GET", `/api/financial/autopay/enrollments/${expandedId}/runs`);
      return res.json();
    },
    enabled: Boolean(expandedId),
  });

  const runCollections = useMutation({
    mutationFn: async () => {
      if (!associationId) throw new Error("No association selected");
      const res = await apiRequest("POST", "/api/financial/autopay/run", { associationId });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Collection run complete",
        description: `${data.succeeded} succeeded, ${data.failed} failed, ${data.skipped} skipped (${data.totalDue} due).`,
      });
      refetch();
    },
    onError: (e: Error) => toast({ title: "Run failed", description: e.message, variant: "destructive" }),
  });

  const updateEnrollment = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/financial/autopay/enrollments/${id}`, updates);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { toast({ title: "Enrollment updated" }); refetch(); },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const filtered = enrollments.filter((e) => statusFilter === "all" || e.status === statusFilter);

  const statusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    if (status === "active") return "default";
    if (status === "paused") return "secondary";
    if (status === "cancelled") return "destructive";
    return "outline";
  };

  const runStatusBadge = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    if (status === "success") return "default";
    if (status === "skipped") return "secondary";
    if (status === "failed") return "destructive";
    return "outline";
  };

  if (!associationId) {
    return <div className="text-sm text-muted-foreground p-4">Select an association to manage autopay enrollments.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{filtered.length} enrollment{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        <Button
          size="sm"
          onClick={() => runCollections.mutate()}
          disabled={runCollections.isPending}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${runCollections.isPending ? "animate-spin" : ""}`} />
          Run Collections Now
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading enrollments...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">No autopay enrollments found.</div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Resident</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((enrollment) => (
                <>
                  <TableRow key={enrollment.id}>
                    <TableCell className="font-medium">
                      {enrollment.building ? `${enrollment.building} ` : ""}{enrollment.unitNumber ?? enrollment.unitId.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span>{enrollment.personFirstName} {enrollment.personLastName}</span>
                        {enrollment.personEmail && (
                          <div className="text-xs text-muted-foreground">{enrollment.personEmail}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{enrollment.frequency}</TableCell>
                    <TableCell>${Number(enrollment.amount).toFixed(2)}</TableCell>
                    <TableCell>
                      {enrollment.nextPaymentDate
                        ? new Date(enrollment.nextPaymentDate).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(enrollment.status)} className="capitalize">
                        {enrollment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {enrollment.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => updateEnrollment.mutate({ id: enrollment.id, updates: { status: "paused" } })}
                          >
                            Pause
                          </Button>
                        )}
                        {enrollment.status === "paused" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => updateEnrollment.mutate({ id: enrollment.id, updates: { status: "active" } })}
                          >
                            Resume
                          </Button>
                        )}
                        {enrollment.status !== "cancelled" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-destructive hover:text-destructive"
                            onClick={() => updateEnrollment.mutate({ id: enrollment.id, updates: { status: "cancelled" } })}
                          >
                            Cancel
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setExpandedId(expandedId === enrollment.id ? null : enrollment.id)}
                        >
                          {expandedId === enrollment.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === enrollment.id && (
                    <TableRow key={`${enrollment.id}-runs`}>
                      <TableCell colSpan={7} className="bg-muted/30 p-4">
                        <div className="text-xs font-semibold mb-2 uppercase tracking-wide text-muted-foreground">Run History</div>
                        {runsLoading ? (
                          <div className="text-xs text-muted-foreground">Loading run history...</div>
                        ) : runs.length === 0 ? (
                          <div className="text-xs text-muted-foreground">No runs recorded yet.</div>
                        ) : (
                          <div className="rounded border bg-background overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Date</TableHead>
                                  <TableHead className="text-xs">Amount</TableHead>
                                  <TableHead className="text-xs">Status</TableHead>
                                  <TableHead className="text-xs">Error</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {runs.map((run) => (
                                  <TableRow key={run.id}>
                                    <TableCell className="text-xs">{new Date(run.ranAt).toLocaleString()}</TableCell>
                                    <TableCell className="text-xs">${Number(run.amount).toFixed(2)}</TableCell>
                                    <TableCell>
                                      <Badge variant={runStatusBadge(run.status)} className="text-xs capitalize">
                                        {run.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-destructive">{run.errorMessage ?? "—"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function FinancialPaymentsPage() {
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const { setActiveAssociationId } = useAssociationContext();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("methods");
  const { data: associations = [] } = useQuery({ queryKey: ["/api/associations"] });

  const selectedAssociationId = activeAssociationId;

  const { data: persons = [], isLoading: personsLoading } = useQuery<Person[]>({ queryKey: ["/api/persons"] });
  const { data: units = [], isLoading: unitsLoading } = useQuery<Unit[]>({ queryKey: ["/api/units"] });

  const { data: gatewayConnections = [], isLoading: gatewayLoading, refetch: refetchGateway } = useQuery<PaymentGatewayConnection[]>({
    queryKey: [selectedAssociationId
      ? `/api/financial/payment-gateway/connections?associationId=${selectedAssociationId}`
      : "/api/financial/payment-gateway/connections"],
  });

  const { data: paymentMethods = [], isLoading: paymentMethodsLoading, refetch: refetchMethods } = useQuery<PaymentMethodConfig[]>({
    queryKey: [selectedAssociationId
      ? `/api/financial/payment-methods?associationId=${selectedAssociationId}`
      : "/api/financial/payment-methods"],
  });

  const [partialRuleForm, setPartialRuleForm] = useState({
    allowPartialPayments: true,
    minimumPaymentAmount: "",
    minimumPaymentPercent: "",
    requirePaymentConfirmation: false,
    sendReceiptEmail: true,
  });

  const { data: partialPaymentRule, refetch: refetchPartialRule } = useQuery<PartialPaymentRule | null>({
    queryKey: ["/api/financial/partial-payment-rules", activeAssociationId],
    queryFn: async () => {
      if (!activeAssociationId) return null;
      const res = await apiRequest("GET", `/api/financial/partial-payment-rules?associationId=${activeAssociationId}`);
      if (res.status === 404) return null;
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  useEffect(() => {
    if (partialPaymentRule) {
      setPartialRuleForm({
        allowPartialPayments: Boolean(partialPaymentRule.allowPartialPayments),
        minimumPaymentAmount: partialPaymentRule.minimumPaymentAmount != null ? String(partialPaymentRule.minimumPaymentAmount) : "",
        minimumPaymentPercent: partialPaymentRule.minimumPaymentPercent != null ? String(partialPaymentRule.minimumPaymentPercent) : "",
        requirePaymentConfirmation: Boolean(partialPaymentRule.requirePaymentConfirmation),
        sendReceiptEmail: Boolean(partialPaymentRule.sendReceiptEmail),
      });
    }
  }, [partialPaymentRule]);

  const savePartialRule = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/financial/partial-payment-rules", {
        associationId: activeAssociationId,
        allowPartialPayments: partialRuleForm.allowPartialPayments ? 1 : 0,
        minimumPaymentAmount: partialRuleForm.minimumPaymentAmount ? parseFloat(partialRuleForm.minimumPaymentAmount) : null,
        minimumPaymentPercent: partialRuleForm.minimumPaymentPercent ? parseFloat(partialRuleForm.minimumPaymentPercent) : null,
        requirePaymentConfirmation: partialRuleForm.requirePaymentConfirmation ? 1 : 0,
        sendReceiptEmail: partialRuleForm.sendReceiptEmail ? 1 : 0,
      });
      return res.json();
    },
    onSuccess: () => { refetchPartialRule(); toast({ title: "Payment rules saved" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col min-h-0">
      <div className="p-6 space-y-6">
      <WorkspacePageHeader
        title="Payments"
        summary="Configure how owners pay their dues — add payment methods, optionally connect an ACH gateway, and generate owner payment links."
        eyebrow="Finance"
        breadcrumbs={[{ label: "Finance", href: "/app/financial/foundation" }, { label: "Payments" }]}
        subPages={financeSubPages}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {isMobile ? (
          <MobileTabBar
            items={[
              { id: "methods", label: paymentMethods.length > 0 ? `Methods ${paymentMethods.length}` : "Methods" },
              { id: "gateway", label: gatewayConnections.filter((c) => c.isActive === 1).length > 0 ? "Gateway On" : "Gateway" },
              { id: "links", label: "Links" },
              { id: "autopay", label: "Autopay" },
              { id: "webhooks", label: "Webhooks" },
              { id: "activity", label: "Activity" },
              { id: "exceptions", label: "Exceptions" },
            ]}
            value={activeTab}
            onChange={setActiveTab}
            variant="tabular"
          />
        ) : (
          <TabsList className="w-full overflow-x-auto">
            <TabsTrigger value="methods" className="gap-1.5 shrink-0">
              <CreditCard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Methods</span>
              {paymentMethods.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">{paymentMethods.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="gateway" className="gap-1.5 shrink-0">
              <Zap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Gateway</span>
              {gatewayConnections.filter((c) => c.isActive === 1).length > 0 && (
                <Badge variant="default" className="ml-1 h-4 px-1 text-xs">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="links" className="gap-1.5 shrink-0">
              <Link2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Links</span>
            </TabsTrigger>
            <TabsTrigger value="autopay" className="gap-1.5 shrink-0">
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Autopay</span>
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-1.5 shrink-0">
              <Webhook className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Webhooks</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5 shrink-0">
              <Info className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Activity</span>
            </TabsTrigger>
            <TabsTrigger value="exceptions" className="gap-1.5 shrink-0">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exceptions</span>
            </TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="methods" className="mt-4">
          <PaymentMethodsTab
            associationId={selectedAssociationId}
            paymentMethods={paymentMethods}
            isLoading={paymentMethodsLoading}
            onSaved={() => refetchMethods()}
          />
        </TabsContent>

        <TabsContent value="gateway" className="mt-4">
          <GatewayTab
            associationId={selectedAssociationId}
            gatewayConnections={gatewayConnections}
            isLoading={gatewayLoading}
            onSaved={() => refetchGateway()}
          />
        </TabsContent>

        <TabsContent value="links" className="mt-4">
          <PaymentLinksTab
            associationId={selectedAssociationId}
            persons={persons}
            units={units}
            isLoadingPeople={personsLoading}
            isLoadingUnits={unitsLoading}
          />
        </TabsContent>

        <TabsContent value="autopay" className="mt-4">
          <AutopayAdminTab associationId={selectedAssociationId} />
        </TabsContent>

        <TabsContent value="webhooks" className="mt-4">
          <WebhookMonitorTab
            associationId={selectedAssociationId}
            persons={persons}
            units={units}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <PaymentActivityTab associationId={selectedAssociationId} />
        </TabsContent>

        <TabsContent value="exceptions" className="mt-4">
          <ExceptionsTab associationId={selectedAssociationId} />
        </TabsContent>
      </Tabs>

      {/* Partial Payment Rules */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Partial Payment Rules</CardTitle>
          <CardDescription>Control whether owners can make partial payments and set minimum payment thresholds</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!activeAssociationId ? (
            <div className="text-sm text-muted-foreground">Select an association to manage payment rules.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="text-sm font-medium">Allow Partial Payments</div>
                    <div className="text-xs text-muted-foreground">Allow owners to pay less than the full balance</div>
                  </div>
                  <Switch
                    checked={partialRuleForm.allowPartialPayments}
                    onCheckedChange={v => setPartialRuleForm(f => ({ ...f, allowPartialPayments: v }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="text-sm font-medium">Require Confirmation</div>
                    <div className="text-xs text-muted-foreground">Show confirmation dialog before payment</div>
                  </div>
                  <Switch
                    checked={partialRuleForm.requirePaymentConfirmation}
                    onCheckedChange={v => setPartialRuleForm(f => ({ ...f, requirePaymentConfirmation: v }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="text-sm font-medium">Send Receipt Email</div>
                    <div className="text-xs text-muted-foreground">Email owner a receipt after payment</div>
                  </div>
                  <Switch
                    checked={partialRuleForm.sendReceiptEmail}
                    onCheckedChange={v => setPartialRuleForm(f => ({ ...f, sendReceiptEmail: v }))}
                  />
                </div>
              </div>
              {partialRuleForm.allowPartialPayments && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Minimum Payment Amount ($)</label>
                    <Input
                      className={isMobile ? "min-h-11" : undefined}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="No minimum"
                      value={partialRuleForm.minimumPaymentAmount}
                      onChange={e => setPartialRuleForm(f => ({ ...f, minimumPaymentAmount: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Minimum Payment % of Balance</label>
                    <Input
                      className={isMobile ? "min-h-11" : undefined}
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      placeholder="No minimum %"
                      value={partialRuleForm.minimumPaymentPercent}
                      onChange={e => setPartialRuleForm(f => ({ ...f, minimumPaymentPercent: e.target.value }))}
                    />
                  </div>
                </div>
              )}
              <div className={`flex justify-end ${isMobile ? "flex-col" : ""}`}>
                <Button size="sm" className={isMobile ? "min-h-11" : undefined} onClick={() => savePartialRule.mutate()} disabled={savePartialRule.isPending}>
                  {savePartialRule.isPending ? "Saving…" : "Save Rules"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
