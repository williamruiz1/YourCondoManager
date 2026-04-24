// zone: My Community
// persona: Owner
//
// 3.5 Q5 (pre-resolved by 4.2 Q3 Session B, 2026-04-24) — /portal/amenities
// remains its own route under the PortalShell, with the 3a amenities-toggle
// runtime gate. Wraps the existing amenities booking content that used to
// live at /portal/amenities (the previous standalone page).
//
// 3.5 Q4 supersedes the Phase 8b in-place session-gate patch on the
// standalone amenities page: the gate is now owned by PortalShell.

import { Fragment, useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Amenity, AmenityReservation } from "@shared/schema";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import NotFound from "@/pages/not-found";
import { PortalShell, usePortalContext } from "./portal-shell";

function WeekGrid({
  busyWindows,
  weekStart,
}: {
  busyWindows: { type: string; startAt: string | Date; endAt: string | Date; reason?: string | null }[];
  weekStart: Date;
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const hours = Array.from({ length: 14 }, (_, i) => i + 7);

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
            <div className="pr-2 pt-1 text-right text-xs text-muted-foreground" style={{ gridColumn: 1 }}>
              {h % 12 === 0 ? 12 : h % 12}
              {h < 12 ? "a" : "p"}
            </div>
            {days.map((d, di) => (
              <div
                key={`${h}-${di}`}
                className={`flex h-7 items-center justify-center border border-border/30 text-xs ${
                  isBusy(d, h) ? "bg-destructive/20 text-destructive" : "bg-green-50 text-green-700"
                }`}
              >
                {isBusy(d, h) ? "Busy" : ""}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function BookingDialog({
  amenity,
  onSuccess,
}: {
  amenity: Amenity;
  onSuccess: () => void;
}) {
  const { portalFetch } = usePortalContext();
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
        const data = (await res.json().catch(() => ({}))) as { message?: string };
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
    onError: (e: unknown) =>
      toast({ title: "Booking failed", description: (e as Error).message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid={`portal-amenities-book-${amenity.id}`}>
          Book now
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Book {amenity.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label>Start</Label>
            <Input
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
            />
          </div>
          <div>
            <Label>End</Label>
            <Input
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
            />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Any special requests…"
            />
          </div>
          <Button
            onClick={() => createReservation.mutate()}
            disabled={createReservation.isPending || !form.startAt || !form.endAt}
          >
            {createReservation.isPending ? "Booking…" : amenity.requiresApproval ? "Request booking" : "Confirm booking"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AmenityCard({ amenity, onBookingSuccess }: { amenity: Amenity; onBookingSuccess: () => void }) {
  const { portalFetch } = usePortalContext();
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

  const { data: availability } = useQuery<{
    busyWindows: { type: string; startAt: string; endAt: string }[];
  }>({
    queryKey: ["/api/portal/amenities", amenity.id, "availability", weekStart.toISOString()],
    queryFn: async () => {
      const res = await portalFetch(
        `/api/portal/amenities/${amenity.id}/availability?from=${weekStart.toISOString()}&to=${weekEnd.toISOString()}`,
      );
      return res.json();
    },
    enabled: showCalendar,
  });

  return (
    <Card data-testid={`portal-amenities-card-${amenity.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{amenity.name}</CardTitle>
            <p className="mt-0.5 text-xs capitalize text-muted-foreground">{amenity.category}</p>
          </div>
          {amenity.requiresApproval ? (
            <Badge variant="outline" className="shrink-0 text-xs">
              Approval required
            </Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0 text-xs">
              Instant booking
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {amenity.description ? <p className="text-sm text-muted-foreground">{amenity.description}</p> : null}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {amenity.capacity ? <span>Up to {amenity.capacity}</span> : null}
          <span>
            {amenity.minDurationMinutes}–{amenity.maxDurationMinutes} min
          </span>
          <span>Book up to {amenity.bookingWindowDays} days ahead</span>
        </div>
        <div className="mt-1 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowCalendar((v) => !v)}>
            {showCalendar ? "Hide calendar" : "View availability"}
          </Button>
          <BookingDialog amenity={amenity} onSuccess={onBookingSuccess} />
        </div>
        {showCalendar ? (
          <div className="mt-2">
            <div className="mb-2 flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const d = new Date(weekStart);
                  d.setDate(d.getDate() - 7);
                  setWeekStart(d);
                }}
              >
                Prev week
              </Button>
              <span className="text-xs text-muted-foreground">
                {weekStart.toLocaleDateString()} – {new Date(weekEnd.getTime() - 1).toLocaleDateString()}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const d = new Date(weekStart);
                  d.setDate(d.getDate() + 7);
                  setWeekStart(d);
                }}
              >
                Next week
              </Button>
            </div>
            <WeekGrid busyWindows={availability?.busyWindows ?? []} weekStart={weekStart} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AmenitiesGatedContent() {
  const { portalAccessId, portalFetch } = usePortalContext();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useQuery<{ amenitiesEnabled: boolean }>({
    queryKey: ["portal/amenities-settings", portalAccessId],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/amenities/settings");
      if (!res.ok) return { amenitiesEnabled: false };
      return res.json();
    },
  });

  const { data: amenityList = [], isLoading } = useQuery<Amenity[]>({
    queryKey: ["/api/portal/amenities", portalAccessId],
    enabled: settings?.amenitiesEnabled === true,
    queryFn: async () => {
      const res = await portalFetch("/api/portal/amenities");
      if (!res.ok) throw new Error("Failed to load amenities");
      return res.json();
    },
  });

  const { data: myReservations = [] } = useQuery<AmenityReservation[]>({
    queryKey: ["/api/portal/amenities/my-reservations", portalAccessId],
    enabled: settings?.amenitiesEnabled === true,
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
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? `Error ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/portal/amenities/my-reservations"] });
      toast({ title: "Reservation cancelled" });
    },
    onError: (e: unknown) =>
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const statusColor = useCallback((status: string): "default" | "secondary" | "destructive" => {
    if (status === "approved") return "default";
    if (status === "pending") return "secondary";
    return "destructive";
  }, []);

  if (settingsLoading) {
    return (
      <div className="py-12 text-center text-sm text-on-surface-variant" data-testid="portal-amenities-loading">
        Loading…
      </div>
    );
  }

  if (settings?.amenitiesEnabled === false) {
    return <NotFound />;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6" data-testid="portal-amenities">
      <div>
        <h1 className="font-headline text-3xl md:text-4xl" data-testid="portal-amenities-heading">
          Amenities
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Reserve a common space or review your upcoming reservations.
        </p>
      </div>
      <Tabs defaultValue="amenities">
        <TabsList>
          <TabsTrigger value="amenities">Amenities</TabsTrigger>
          <TabsTrigger value="my-reservations">
            My reservations {myReservations.length > 0 ? `(${myReservations.length})` : ""}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="amenities" className="mt-4">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
          {!isLoading && amenityList.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No amenities available for booking at this time.
              </CardContent>
            </Card>
          ) : null}
          <div className="flex flex-col gap-4">
            {amenityList.map((amenity) => (
              <AmenityCard
                key={amenity.id}
                amenity={amenity}
                onBookingSuccess={() =>
                  qc.invalidateQueries({ queryKey: ["/api/portal/amenities/my-reservations"] })
                }
              />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="my-reservations" className="mt-4">
          {myReservations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No upcoming reservations.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {myReservations.map((r) => {
                const amenity = amenityList.find((a) => a.id === r.amenityId);
                return (
                  <Card key={r.id}>
                    <CardContent className="flex items-start justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium">{amenity?.name ?? r.amenityId}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(r.startAt).toLocaleString()} – {new Date(r.endAt).toLocaleTimeString()}
                        </p>
                        {r.notes ? <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p> : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <Badge variant={statusColor(r.status)}>{r.status}</Badge>
                        {r.status === "pending" || r.status === "approved" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cancelReservation.mutate(r.id)}
                            disabled={cancelReservation.isPending}
                          >
                            Cancel
                          </Button>
                        ) : null}
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
  );
}

export default function PortalAmenitiesPage() {
  useDocumentTitle("Amenities");
  return (
    <PortalShell>
      <AmenitiesGatedContent />
    </PortalShell>
  );
}

export { AmenitiesGatedContent };
