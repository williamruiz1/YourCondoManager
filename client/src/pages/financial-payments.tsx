import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveAssociation } from "@/hooks/use-active-association";
import type { OwnerPaymentLink, PaymentGatewayConnection, Person, Unit } from "@shared/schema";

export default function FinancialPaymentsPage() {
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [gatewayForm, setGatewayForm] = useState({
    associationId: "",
    provider: "stripe" as "stripe" | "other",
    providerAccountId: "",
    publishableKey: "",
    secretKey: "",
    webhookSecret: "",
    isActive: true,
  });
  const [paymentLinkForm, setPaymentLinkForm] = useState({
    associationId: "",
    unitId: "",
    personId: "",
    amount: "",
    currency: "USD",
    allowPartial: false,
    memo: "",
    expiresAt: "",
  });
  const [webhookTestForm, setWebhookTestForm] = useState({
    associationId: "",
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
  const [lastGeneratedPaymentLink, setLastGeneratedPaymentLink] = useState<{
    link: OwnerPaymentLink;
    paymentUrl: string;
    outstandingBalance: number;
  } | null>(null);
  const [lastWebhookMessage, setLastWebhookMessage] = useState("");

  const selectedAssociationId = activeAssociationId;

  const { data: persons } = useQuery<Person[]>({ queryKey: ["/api/persons"] });
  const { data: units } = useQuery<Unit[]>({ queryKey: ["/api/units"] });
  const { data: gatewayConnections } = useQuery<PaymentGatewayConnection[]>({
    queryKey: [selectedAssociationId ? `/api/financial/payment-gateway/connections?associationId=${selectedAssociationId}` : "/api/financial/payment-gateway/connections"],
  });

  useEffect(() => {
    setGatewayForm((prev) => ({ ...prev, associationId: activeAssociationId }));
    setPaymentLinkForm((prev) => ({ ...prev, associationId: activeAssociationId }));
    setWebhookTestForm((prev) => ({ ...prev, associationId: activeAssociationId }));
    setLastGeneratedPaymentLink(null);
    setLastWebhookMessage("");
  }, [activeAssociationId]);

  const validateGateway = useMutation({
    mutationFn: async () => {
      if (!gatewayForm.associationId) throw new Error("Association is required");
      const res = await apiRequest("POST", "/api/financial/payment-gateway/validate", {
        associationId: gatewayForm.associationId,
        provider: gatewayForm.provider,
        providerAccountId: gatewayForm.providerAccountId.trim() || null,
        publishableKey: gatewayForm.publishableKey.trim() || null,
        secretKey: gatewayForm.secretKey.trim() || null,
        webhookSecret: gatewayForm.webhookSecret.trim() || null,
        isActive: gatewayForm.isActive,
      });
      return res.json() as Promise<{ validated: boolean; checks: string[] }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: [selectedAssociationId ? `/api/financial/payment-gateway/connections?associationId=${selectedAssociationId}` : "/api/financial/payment-gateway/connections"],
      });
      setGatewayForm((prev) => ({ ...prev, secretKey: "", webhookSecret: "" }));
      toast({ title: "Gateway validated", description: result.checks.join(" ") });
    },
    onError: (err: Error) => toast({ title: "Gateway validation failed", description: err.message, variant: "destructive" }),
  });

  const generatePaymentLink = useMutation({
    mutationFn: async () => {
      if (!paymentLinkForm.associationId || !paymentLinkForm.unitId || !paymentLinkForm.personId) {
        throw new Error("Association, unit, and person are required");
      }
      const amountRaw = paymentLinkForm.amount.trim();
      const amount = amountRaw ? Number(amountRaw) : null;
      if (amountRaw && (amount == null || !Number.isFinite(amount) || amount <= 0)) {
        throw new Error("Amount must be a positive number");
      }
      const res = await apiRequest("POST", "/api/financial/owner-payment-links", {
        associationId: paymentLinkForm.associationId,
        unitId: paymentLinkForm.unitId,
        personId: paymentLinkForm.personId,
        amount,
        currency: paymentLinkForm.currency || "USD",
        allowPartial: paymentLinkForm.allowPartial,
        memo: paymentLinkForm.memo.trim() || null,
        expiresAt: paymentLinkForm.expiresAt || null,
      });
      return res.json() as Promise<{ link: OwnerPaymentLink; paymentUrl: string; outstandingBalance: number }>;
    },
    onSuccess: (result) => {
      setLastGeneratedPaymentLink(result);
      setWebhookTestForm((prev) => ({
        ...prev,
        paymentLinkToken: result.link.token,
        amount: String(result.link.amount),
        unitId: result.link.unitId,
        personId: result.link.personId,
      }));
      toast({ title: "Payment link generated", description: `Outstanding ${result.outstandingBalance.toFixed(2)}.` });
    },
    onError: (err: Error) => toast({ title: "Payment link error", description: err.message, variant: "destructive" }),
  });

  const sendWebhookTest = useMutation({
    mutationFn: async () => {
      if (!webhookTestForm.associationId || !webhookTestForm.providerEventId.trim()) {
        throw new Error("Association and provider event id are required");
      }
      const amountRaw = webhookTestForm.amount.trim();
      const amount = amountRaw ? Number(amountRaw) : null;
      if (amountRaw && (amount == null || !Number.isFinite(amount))) {
        throw new Error("Webhook amount must be numeric");
      }
      const res = await apiRequest("POST", "/api/webhooks/payments", {
        associationId: webhookTestForm.associationId,
        provider: webhookTestForm.provider,
        providerEventId: webhookTestForm.providerEventId.trim(),
        eventType: webhookTestForm.eventType.trim() || null,
        status: webhookTestForm.status,
        amount,
        currency: webhookTestForm.currency || "USD",
        personId: webhookTestForm.personId.trim() || null,
        unitId: webhookTestForm.unitId.trim() || null,
        paymentLinkToken: webhookTestForm.paymentLinkToken.trim() || null,
        gatewayReference: webhookTestForm.gatewayReference.trim() || null,
      });
      return res.json() as Promise<{ message: string; duplicate: boolean }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/owner-ledger/entries"] });
      setLastWebhookMessage(result.message);
      toast({
        title: result.duplicate ? "Webhook replay detected" : "Webhook processed",
        description: result.message,
      });
    },
    onError: (err: Error) => toast({ title: "Webhook test failed", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground">Gateway setup, owner payment links, and webhook reconciliation.</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
          </div>

          <div className="space-y-3 border rounded-md p-4">
            <div className="text-sm font-medium">1) Validate Gateway Connection</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select value={gatewayForm.provider} onValueChange={(value) => setGatewayForm((p) => ({ ...p, provider: value as "stripe" | "other" }))}>
                <SelectTrigger><SelectValue placeholder="Provider" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stripe">stripe</SelectItem>
                  <SelectItem value="other">other</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Provider account id (optional)" value={gatewayForm.providerAccountId} onChange={(e) => setGatewayForm((p) => ({ ...p, providerAccountId: e.target.value }))} />
              <Input placeholder="Publishable key" value={gatewayForm.publishableKey} onChange={(e) => setGatewayForm((p) => ({ ...p, publishableKey: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input placeholder="Secret key" value={gatewayForm.secretKey} onChange={(e) => setGatewayForm((p) => ({ ...p, secretKey: e.target.value }))} />
              <Input placeholder="Webhook secret" value={gatewayForm.webhookSecret} onChange={(e) => setGatewayForm((p) => ({ ...p, webhookSecret: e.target.value }))} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={gatewayForm.isActive} onChange={(e) => setGatewayForm((p) => ({ ...p, isActive: e.target.checked }))} />
                Connection active
              </label>
            </div>
            <Button onClick={() => validateGateway.mutate()} disabled={validateGateway.isPending}>Validate and Save Gateway</Button>
            <div className="text-xs text-muted-foreground">
              Active connections: {(gatewayConnections ?? []).filter((row) => row.isActive === 1).length}
            </div>
          </div>

          <div className="space-y-3 border rounded-md p-4">
            <div className="text-sm font-medium">2) Generate Owner Payment Link</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Select value={paymentLinkForm.unitId || "none"} onValueChange={(value) => setPaymentLinkForm((p) => ({ ...p, unitId: value === "none" ? "" : value }))}>
                <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">select unit</SelectItem>
                  {(units ?? []).filter((u) => !selectedAssociationId || u.associationId === selectedAssociationId).map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>{unit.unitNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={paymentLinkForm.personId || "none"} onValueChange={(value) => setPaymentLinkForm((p) => ({ ...p, personId: value === "none" ? "" : value }))}>
                <SelectTrigger><SelectValue placeholder="Person" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">select person</SelectItem>
                  {(persons ?? []).map((person) => (
                    <SelectItem key={person.id} value={person.id}>{person.firstName} {person.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Amount (blank = outstanding)" value={paymentLinkForm.amount} onChange={(e) => setPaymentLinkForm((p) => ({ ...p, amount: e.target.value }))} />
              <Input type="datetime-local" value={paymentLinkForm.expiresAt} onChange={(e) => setPaymentLinkForm((p) => ({ ...p, expiresAt: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input placeholder="Currency" value={paymentLinkForm.currency} onChange={(e) => setPaymentLinkForm((p) => ({ ...p, currency: e.target.value }))} />
              <Input placeholder="Memo (optional)" value={paymentLinkForm.memo} onChange={(e) => setPaymentLinkForm((p) => ({ ...p, memo: e.target.value }))} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={paymentLinkForm.allowPartial} onChange={(e) => setPaymentLinkForm((p) => ({ ...p, allowPartial: e.target.checked }))} />
                Allow partial payments
              </label>
            </div>
            <Button onClick={() => generatePaymentLink.mutate()} disabled={generatePaymentLink.isPending}>Generate Payment Link</Button>
            {lastGeneratedPaymentLink ? (
              <div className="rounded border bg-muted/20 p-3 text-sm space-y-1">
                <div>Link URL: <span className="font-mono break-all">{lastGeneratedPaymentLink.paymentUrl}</span></div>
                <div>Token: <span className="font-mono break-all">{lastGeneratedPaymentLink.link.token}</span></div>
                <div>Amount: {lastGeneratedPaymentLink.link.amount} {lastGeneratedPaymentLink.link.currency}</div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 border rounded-md p-4">
            <div className="text-sm font-medium">3) Test Inbound Payment Webhook</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input placeholder="Provider event id" value={webhookTestForm.providerEventId} onChange={(e) => setWebhookTestForm((p) => ({ ...p, providerEventId: e.target.value }))} />
              <Select value={webhookTestForm.provider} onValueChange={(value) => setWebhookTestForm((p) => ({ ...p, provider: value as "stripe" | "other" }))}>
                <SelectTrigger><SelectValue placeholder="Provider" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stripe">stripe</SelectItem>
                  <SelectItem value="other">other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={webhookTestForm.status} onValueChange={(value) => setWebhookTestForm((p) => ({ ...p, status: value as "succeeded" | "failed" | "pending" }))}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="succeeded">succeeded</SelectItem>
                  <SelectItem value="failed">failed</SelectItem>
                  <SelectItem value="pending">pending</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Amount" value={webhookTestForm.amount} onChange={(e) => setWebhookTestForm((p) => ({ ...p, amount: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input placeholder="Event type" value={webhookTestForm.eventType} onChange={(e) => setWebhookTestForm((p) => ({ ...p, eventType: e.target.value }))} />
              <Input placeholder="Person id" value={webhookTestForm.personId} onChange={(e) => setWebhookTestForm((p) => ({ ...p, personId: e.target.value }))} />
              <Input placeholder="Unit id" value={webhookTestForm.unitId} onChange={(e) => setWebhookTestForm((p) => ({ ...p, unitId: e.target.value }))} />
              <Input placeholder="Payment link token" value={webhookTestForm.paymentLinkToken} onChange={(e) => setWebhookTestForm((p) => ({ ...p, paymentLinkToken: e.target.value }))} />
            </div>
            <Input placeholder="Gateway reference (optional)" value={webhookTestForm.gatewayReference} onChange={(e) => setWebhookTestForm((p) => ({ ...p, gatewayReference: e.target.value }))} />
            <Button onClick={() => sendWebhookTest.mutate()} disabled={sendWebhookTest.isPending}>Send Test Webhook</Button>
            {lastWebhookMessage ? <div className="text-sm text-muted-foreground">{lastWebhookMessage}</div> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
