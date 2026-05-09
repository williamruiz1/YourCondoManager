/**
 * CommunityMapView
 *
 * Public-facing Google Maps embed for the community hub. Shows building pins,
 * supports tap-to-explore (building unit list) and tap-to-report (issue form).
 *
 * Resident interactions:
 *  1. Tap a building pin → slide-up / sidebar panel with building name + units
 *  2. Tap anywhere on the map → report-issue form, location pre-filled
 *
 * Falls back gracefully when:
 *  - No API key is configured (renders nothing — caller hides the section)
 *  - Association has no lat/lng (attempts geocoding via address string)
 *  - No building pins exist (renders map only, without pins)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, MapPin, X, AlertCircle, Building2, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { loadGoogleMaps, hasMapsApiKey } from "@/lib/maps-loader";

// ---- types ----------------------------------------------------------------

interface MapNode {
  id: string;
  label: string;
  geometry: { lat: number; lng: number };
  linkedBuildingId: string | null;
  nodeType: string;
}

interface PublicBuilding {
  id: string;
  name: string;
  address: string;
  totalUnits: number | null;
  notes: string | null;
  unitCount: number;
}

interface MapAssociation {
  name: string;
  address: string;
  city: string;
  state: string;
  latitudeDeg: string | null;
  longitudeDeg: string | null;
}

interface IssueReport {
  lat: number;
  lng: number;
  title: string;
  description: string;
  category: string;
}

interface CommunityMapViewProps {
  identifier: string; // hub slug or association id
  themeColor?: string;
  buildings?: PublicBuilding[];
}

// ---- issue categories -----------------------------------------------------
const ISSUE_CATEGORIES = [
  { value: "maintenance", label: "Maintenance" },
  { value: "repair", label: "Repair" },
  { value: "safety", label: "Safety" },
  { value: "landscaping", label: "Landscaping" },
  { value: "suggestion", label: "Suggestion" },
  { value: "other", label: "Other" },
];

// ---- report issue form ----------------------------------------------------

interface ReportFormProps {
  lat: number;
  lng: number;
  identifier: string;
  themeColor: string;
  onClose: () => void;
}

function ReportIssueForm({
  lat,
  lng,
  identifier,
  themeColor,
  onClose,
}: ReportFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("maintenance");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      // Use the portal map issues endpoint (requires portal auth session)
      const res = await fetch("/api/hub/portal/map/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          coordinates: { lat, lng },
          // layerId will be resolved server-side or omitted; route accepts missing layerId
        } satisfies Partial<IssueReport> & { coordinates: { lat: number; lng: number } }),
        credentials: "include",
      });

      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        setError(body.message ?? "Failed to submit. Are you logged in?");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-6">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
        <p className="font-medium">Report submitted</p>
        <p className="text-sm text-muted-foreground mt-1">
          The community manager has been notified.
        </p>
        <Button className="mt-4" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <FileWarning className="h-4 w-4 text-amber-500" />
        <h3 className="font-semibold text-sm">Report an Issue</h3>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-muted-foreground hover:text-foreground p-1"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Location: {lat.toFixed(5)}, {lng.toFixed(5)}
      </p>

      <div>
        <label className="text-xs font-medium mb-1 block">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {ISSUE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium mb-1 block">
          Title <span className="text-destructive">*</span>
        </label>
        <Input
          placeholder="Brief description of the issue"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="h-9 text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium mb-1 block">Details (optional)</label>
        <textarea
          placeholder="Additional context…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px] resize-none"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          className="flex-1 h-9"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1 h-9"
          disabled={submitting || !title.trim()}
          style={{ backgroundColor: themeColor, borderColor: themeColor }}
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Submit Report"
          )}
        </Button>
      </div>
    </form>
  );
}

// ---- building panel -------------------------------------------------------

interface BuildingPanelProps {
  building: PublicBuilding | null;
  identifier: string;
  onClose: () => void;
}

interface UnitData {
  id: string;
  unitNumber: string;
  building: string | null;
  squareFootage: number | null;
}

function BuildingPanel({ building, identifier, onClose }: BuildingPanelProps) {
  const [units, setUnits] = useState<UnitData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!building) return;
    setLoading(true);
    fetch(`/api/hub/${encodeURIComponent(identifier)}/buildings/${building.id}`)
      .then((r) => r.json())
      .then((data: { units: UnitData[] }) => setUnits(data.units ?? []))
      .catch(() => setUnits([]))
      .finally(() => setLoading(false));
  }, [building, identifier]);

  if (!building) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm flex-1">{building.name}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {building.address && (
        <p className="text-xs text-muted-foreground">{building.address}</p>
      )}
      <p className="text-xs text-muted-foreground">
        {building.unitCount} unit{building.unitCount !== 1 ? "s" : ""}
      </p>

      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : units.length > 0 ? (
        <div className="max-h-48 overflow-y-auto space-y-1">
          {units.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-xs"
            >
              <span className="font-medium">Unit {u.unitNumber}</span>
              {u.squareFootage && (
                <span className="text-muted-foreground">
                  {u.squareFootage.toLocaleString()} sqft
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">No units listed</p>
      )}
    </div>
  );
}

// ---- main component -------------------------------------------------------

export default function CommunityMapView({
  identifier,
  themeColor = "#3b82f6",
  buildings = [],
}: CommunityMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Panel state
  const [activeBuilding, setActiveBuilding] = useState<PublicBuilding | null>(
    null,
  );
  const [reportCoords, setReportCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const buildingsById = buildings.reduce<Record<string, PublicBuilding>>(
    (acc, b) => ({ ...acc, [b.id]: b }),
    {},
  );

  const handleBuildingPinClick = useCallback(
    (linkedBuildingId: string | null, label: string) => {
      setReportCoords(null);
      if (linkedBuildingId && buildingsById[linkedBuildingId]) {
        setActiveBuilding(buildingsById[linkedBuildingId]);
      } else {
        // No linked building record — show label only
        setActiveBuilding({
          id: linkedBuildingId ?? label,
          name: label,
          address: "",
          totalUnits: null,
          notes: null,
          unitCount: 0,
        });
      }
    },
    [buildingsById],
  );

  // ---- load map -----------------------------------------------------------
  useEffect(() => {
    if (!hasMapsApiKey) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        const g = await loadGoogleMaps();
        if (cancelled || !g || !mapContainerRef.current) return;

        // Fetch association map data
        const res = await fetch(
          `/api/hub/${encodeURIComponent(identifier)}/map`,
        );
        if (!res.ok) throw new Error("Map data unavailable");
        const data = (await res.json()) as {
          association: MapAssociation | null;
          nodes: MapNode[];
        };

        const assoc = data.association;

        let center = { lat: 25.7617, lng: -80.1918 }; // Miami fallback

        if (
          assoc?.latitudeDeg &&
          assoc?.longitudeDeg
        ) {
          center = {
            lat: parseFloat(assoc.latitudeDeg),
            lng: parseFloat(assoc.longitudeDeg),
          };
        } else if (assoc?.address) {
          // Geocode from address string
          const geocoder = new g.maps.Geocoder();
          const fullAddress = [assoc.address, assoc.city, assoc.state]
            .filter(Boolean)
            .join(", ");
          const geocodeRes = await geocoder.geocode({ address: fullAddress });
          if (geocodeRes.results[0]?.geometry?.location) {
            const loc = geocodeRes.results[0].geometry.location;
            center = { lat: loc.lat(), lng: loc.lng() };
          }
        }

        if (cancelled || !mapContainerRef.current) return;

        const map = new g.maps.Map(mapContainerRef.current, {
          center,
          zoom: 17,
          mapTypeId: "satellite",
          tilt: 0,
          gestureHandling: "greedy",
          disableDefaultUI: false,
        });
        mapRef.current = map;

        // Drop building pins
        for (const node of data.nodes) {
          if (!node.geometry?.lat || !node.geometry?.lng) continue;

          const marker = new g.maps.Marker({
            position: { lat: node.geometry.lat, lng: node.geometry.lng },
            map,
            title: node.label,
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: themeColor,
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          });

          const infoWindow = new g.maps.InfoWindow({
            content: `<div style="font-size:13px;font-weight:600;padding:2px 4px">${node.label}</div>`,
          });

          marker.addListener("click", () => {
            infoWindow.open(map, marker);
            handleBuildingPinClick(node.linkedBuildingId, node.label);
          });
        }

        // Map click → open report form
        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          setActiveBuilding(null);
          setReportCoords({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });

        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load map",
          );
          setIsLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [identifier, themeColor, handleBuildingPinClick]);

  // ---- render -------------------------------------------------------------

  if (!hasMapsApiKey) return null;

  const hasPanel = activeBuilding !== null || reportCoords !== null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="h-5 w-5" style={{ color: themeColor }} />
        <h2 className="text-lg font-semibold">Community Map</h2>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {/* Map */}
          <div className="relative flex-1 min-h-0">
            <div
              ref={mapContainerRef}
              style={{ width: "100%", height: "360px" }}
            />

            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {loadError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2 p-4 bg-muted/40">
                <MapPin className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{loadError}</p>
              </div>
            )}

            {!isLoading && !loadError && (
              <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-muted-foreground shadow pointer-events-none">
                Tap a pin to explore · Tap map to report an issue
              </div>
            )}
          </div>

          {/* Side / bottom panel */}
          {hasPanel && (
            <div className="sm:w-72 border-t sm:border-t-0 sm:border-l bg-background p-4">
              {activeBuilding && (
                <BuildingPanel
                  building={activeBuilding}
                  identifier={identifier}
                  onClose={() => setActiveBuilding(null)}
                />
              )}
              {reportCoords && !activeBuilding && (
                <ReportIssueForm
                  lat={reportCoords.lat}
                  lng={reportCoords.lng}
                  identifier={identifier}
                  themeColor={themeColor}
                  onClose={() => setReportCoords(null)}
                />
              )}
            </div>
          )}
        </div>

        {/* Street View static image strip */}
        {!isLoading && !loadError && (
          <div className="border-t px-0 py-0">
            <StreetViewStrip identifier={identifier} />
          </div>
        )}
      </Card>
    </section>
  );
}

// ---- Street View strip (static image) ------------------------------------

function StreetViewStrip({ identifier }: { identifier: string }) {
  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/hub/${encodeURIComponent(identifier)}/map`)
      .then((r) => r.json())
      .then((data: { association: MapAssociation | null }) => {
        const a = data.association;
        if (a?.latitudeDeg && a?.longitudeDeg) {
          setCoords({
            lat: parseFloat(a.latitudeDeg),
            lng: parseFloat(a.longitudeDeg),
          });
        }
      })
      .catch(() => undefined);
  }, [identifier]);

  if (!coords) return null;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
  const svUrl =
    `https://maps.googleapis.com/maps/api/streetview` +
    `?size=800x160&location=${coords.lat},${coords.lng}&fov=100&pitch=0&key=${apiKey}`;

  return (
    <img
      src={svUrl}
      alt="Street View of community entrance"
      className="w-full object-cover"
      style={{ height: "120px" }}
      loading="lazy"
    />
  );
}
