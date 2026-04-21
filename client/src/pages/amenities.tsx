// zone: My Community
// persona: Owner
import { Fragment, useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Amenity, AmenityReservation } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OwnerPortalLoginContainer } from "@/components/owner-portal-login-container";
import { Link } from "wouter";
import { ChevronLeft, Clock, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

// One week of 1-hour slots displayed as a simple grid
function WeekGrid({ busyWindows, weekStart }: { busyWindows: { type: string; startAt: string | Date; endAt: string | Date; reason?: string | null }[]; weekStart: Date }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7am–8pm

  function isBusy(day: Date, hour: number) {
    const slotStart = new Date(day);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setHours(hour + 1, 0, 0, 0);
    return busyWindows.some((w) => {
      const ws = new Date(w.startAt);
      const we = new Date(w.endAt);
      return ws < slotEnd && we > slotStart;
    });
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[560px]" style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}>
        <div />
        {days.map((d, i) => (
          <div key={i} className="text-center text-xs font-medium py-1 border-b">
            <div>{dayNames[d.getDay()]}</div>
            <div className="text-muted-foreground">{d.getDate()}</div>
          </div>
        ))}
        {hours.map((h) => (
          <Fragment key={h}>
            <div className="text-xs text-muted-foreground pr-2 text-right pt-1" style={{ gridColumn: 1 }}>
              {h % 12 === 0 ? 12 : h % 12}{h < 12 ? "a" : "p"}
            </div>
            {days.map((d, di) => (
              <div
                key={`${h}-${di}`}
                className={`h-7 border border-border/30 text-xs flex items-center justify-center ${isBusy(d, h) ? "bg-destructive/20 text-destructive" : "bg-green-50 text-green-700"}`}
              >
                {isBusy(d, h) ? "Busy" : ""}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
      <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300" />Available</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive/20 border border-destructive/40" />Busy</span>
      </div>
    </div>
  );
}

function AmenityCard({ amenity, portalFetch, onBookingSuccess }: { amenity: Amenity; portalFetch: (url: string, opts?: RequestInit) => Promise<Response>; onBookingSuccess: () => void }) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const day = now.getDay();
    now.setDate(now.getDate() - day);
    return now;
  });

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const { data: availability } = useQuery<{ busyWindows: { type: string; startAt: string; endAt: string; reason?: string | null; status?: string }[] }>({
    queryKey: ["/api/portal/amenities", amenity.id, "availability", weekStart.toISOString()],
    queryFn: async () => {
      const res = await portalFetch(`/api/portal/amenities/${amenity.id}/availability?from=${weekStart.toISOString()}&to=${weekEnd.toISOString()}`);
      return res.json();
    },
    enabled: showCalendar,
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{amenity.name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{amenity.category}</p>
          </div>
          {amenity.requiresApproval ? (
            <Badge variant="outline" className="text-xs shrink-0">Approval required</Badge>
          ) : (
            <Badge variant="secondary" className="text-xs shrink-0">Instant booking</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {amenity.description && <p className="text-sm text-muted-foreground">{amenity.description}</p>}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {amenity.capacity && (
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />Up to {amenity.capacity}</span>
          )}
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{amenity.minDurationMinutes}–{amenity.maxDurationMinutes} min</span>
          <span>Book up to {amenity.bookingWindowDays} days ahead</span>
        </div>
        <div className="flex gap-2 mt-1">
          <Button size="sm" variant="outline" onClick={() => setShowCalendar((v) => !v)}>
            {showCalendar ? "Hide Calendar" : "View Availability"}
          </Button>
          <BookingDialog amenity={amenity} portalFetch={portalFetch} onSuccess={onBookingSuccess} />
        </div>
        {showCalendar && (
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-2">
              <Button size="sm" variant="ghost" onClick={() => {
                const d = new Date(weekStart);
                d.setDate(d.getDate() - 7);
                setWeekStart(d);
              }}>Prev week</Button>
              <span className="text-xs text-muted-foreground">
                {weekStart.toLocaleDateString()} – {new Date(weekEnd.getTime() - 1).toLocaleDateString()}
              </span>
              <Button size="sm" variant="ghost" onClick={() => {
                const d = new Date(weekStart);
                d.setDate(d.getDate() + 7);
                setWeekStart(d);
              }}>Next week</Button>
            </div>
            <WeekGrid busyWindows={availability?.busyWindows ?? []} weekStart={weekStart} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BookingDialog({ amenity, portalFetch, onSuccess }: { amenity: Amenity; portalFetch: (url: string, opts?: RequestInit) => Promise<Response>; onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ startAt: "", endAt: "", notes: "" });

  const createReservation = useMutation({
    mutationFn: async () => {
      const res = await portalFetch(`/api/portal/amenities/${amenity.id}/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt: form.startAt,
          endAt: form.endAt,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `Error ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      setOpen(false);
      setForm({ startAt: "", endAt: "", notes: "" });
      toast({ title: amenity.requiresApproval ? "Reservation submitted, pending approval" : "Reservation confirmed" });
      onSuccess();
    },
    onError: (e: any) => toast({ title: "Booking failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Book Now</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Book {amenity.name}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="text-xs text-muted-foreground">
            Duration: {amenity.minDurationMinutes}–{amenity.maxDurationMinutes} min
            {amenity.requiresApproval && " (requires admin approval)"}
          </div>
          <div>
            <Label>Start</Label>
            <Input type="datetime-local" value={form.startAt} onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))} />
          </div>
          <div>
            <Label>End</Label>
            <Input type="datetime-local" value={form.endAt} onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))} />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any special requests..." />
          </div>
          <Button onClick={() => createReservation.mutate()} disabled={createReservation.isPending || !form.startAt || !form.endAt}>
            {createReservation.isPending ? "Booking..." : amenity.requiresApproval ? "Request Booking" : "Confirm Booking"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AmenitiesPortalContent({ portalAccessId }: { portalAccessId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const portalFetch = (url: string, options: RequestInit = {}) =>
    fetch(url, { ...options, headers: { ...(options.headers ?? {}), "x-portal-access-id": portalAccessId } });

  const { data: amenityList = [], isLoading } = useQuery<Amenity[]>({
    queryKey: ["/api/portal/amenities", portalAccessId],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/amenities");
      if (!res.ok) throw new Error("Failed to load amenities");
      return res.json();
    },
  });

  const { data: myReservations = [] } = useQuery<AmenityReservation[]>({
    queryKey: ["/api/portal/amenities/my-reservations", portalAccessId],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/amenities/my-reservations");
      if (!res.ok) throw new Error("Failed to load reservations");
      return res.json();
    },
  });

  const cancelReservation = useMutation({
    mutationFn: async (id: string) => {
      const res = await portalFetch(`/api/portal/amenity-reservations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `Error ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/portal/amenities/my-reservations"] });
      toast({ title: "Reservation cancelled" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function statusColor(status: string) {
    if (status === "approved") return "default" as const;
    if (status === "pending") return "secondary" as const;
    return "destructive" as const;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/portal">
            <Button variant="ghost" size="sm" className="gap-1"><ChevronLeft className="w-4 h-4" />Back</Button>
          </Link>
          <h1 className="text-xl font-semibold">Amenity Booking</h1>
        </div>

        <Tabs defaultValue="amenities">
          <TabsList className="mb-4">
            <TabsTrigger value="amenities">Amenities</TabsTrigger>
            <TabsTrigger value="my-reservations">My Reservations {myReservations.length > 0 && `(${myReservations.length})`}</TabsTrigger>
          </TabsList>

          <TabsContent value="amenities">
            {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
            {!isLoading && amenityList.length === 0 && (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No amenities available for booking at this time.</CardContent></Card>
            )}
            <div className="flex flex-col gap-4">
              {amenityList.map((amenity) => (
                <AmenityCard
                  key={amenity.id}
                  amenity={amenity}
                  portalFetch={portalFetch}
                  onBookingSuccess={() => qc.invalidateQueries({ queryKey: ["/api/portal/amenities/my-reservations"] })}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="my-reservations">
            {myReservations.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No upcoming reservations.</CardContent></Card>
            ) : (
              <div className="flex flex-col gap-3">
                {myReservations.map((r) => {
                  const amenity = amenityList.find((a) => a.id === r.amenityId);
                  return (
                    <Card key={r.id}>
                      <CardContent className="py-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm">{amenity?.name ?? r.amenityId}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(r.startAt).toLocaleString()} – {new Date(r.endAt).toLocaleTimeString()}
                          </p>
                          {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <Badge variant={statusColor(r.status)}>{r.status}</Badge>
                          {(r.status === "pending" || r.status === "approved") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelReservation.mutate(r.id)}
                              disabled={cancelReservation.isPending}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function AmenitiesPage() {
  useDocumentTitle("Amenities");
  // 2.2 Q6 (LOCKED): /portal/amenities must inherit /portal session-redirect pattern.
  // T4 quick-win fix — superseded by 3.5 Owner Portal Restructure per 4.2 Q5.
  const [portalAccessId, setPortalAccessId] = useState<string | null>(() => window.localStorage.getItem("portalAccessId"));

  // 2.2 Q6 (LOCKED): mirror /portal — validate portalAccessId via /api/portal/me
  // before rendering portal content. A stale/revoked id in localStorage must
  // surface the same "Unable to load portal" + Sign Out UX as /portal, not
  // silently load the page and let API calls fail. See owner-portal.tsx lines
  // 352–362 + 1217–1237 for the canonical pattern this mirrors.
  const { refetch: refetchMe, error: meError, isError: isMeError } = useQuery<unknown>({
    queryKey: ["portal/me", portalAccessId],
    enabled: !!portalAccessId,
    retry: 2,
    queryFn: async () => {
      if (!portalAccessId) return null;
      const res = await fetch(`/api/portal/me`, { headers: { "x-portal-access-id": portalAccessId } });
      if (!res.ok) throw new Error(`Portal session failed (${res.status})`);
      return res.json();
    },
  });

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem("portalAccessId");
    setPortalAccessId(null);
  }, []);

  if (!portalAccessId) {
    return (
      <OwnerPortalLoginContainer onLoginSuccess={(id) => {
        setPortalAccessId(id);
        window.localStorage.setItem("portalAccessId", id);
      }} />
    );
  }

  if (isMeError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low">
        <div className="text-center max-w-md p-8">
          <h2 className="text-xl font-semibold text-on-surface mb-2">Unable to load portal</h2>
          <p className="text-sm text-on-surface-variant mb-4">{(meError as Error | undefined)?.message || "An unexpected error occurred. Please try again."}</p>
          <div className="flex gap-2 justify-center">
            <button className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold" onClick={() => refetchMe()}>Retry</button>
            <button className="px-4 py-2 border border-outline-variant rounded-lg text-sm font-medium text-on-surface-variant" onClick={handleLogout}>Sign Out</button>
          </div>
        </div>
      </div>
    );
  }

  return <AmenitiesPortalContent portalAccessId={portalAccessId} />;
}
