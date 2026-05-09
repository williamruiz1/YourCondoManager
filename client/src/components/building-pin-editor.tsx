/**
 * BuildingPinEditor
 *
 * Interactive satellite map for placing building pins during association
 * onboarding. Also accessible from admin Community Hub settings ("Edit
 * Building Map").
 *
 * Flow:
 *  1. Component mounts → loads Google Maps SDK → renders satellite view
 *  2. Admin clicks "📍 Place Building" to enter pin-placement mode
 *  3. Click on map → animated pin drops → inline label input appears
 *  4. Confirm building name → POST /api/associations/:id/hub/map/nodes
 *  5. Pins can be dragged (geometry updates on drag-end) or deleted
 *  6. "Done →" navigates away (calls onDone prop)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, MapPin, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { loadGoogleMaps } from "@/lib/maps-loader";

// ---- types ----------------------------------------------------------------

interface PlacedPin {
  /** Temporary client-side id before API save */
  clientId: string;
  /** Server-assigned id after save (null = saving / unsaved) */
  serverId: string | null;
  lat: number;
  lng: number;
  label: string;
  /** Whether this pin is still awaiting a label from the user */
  awaitingLabel: boolean;
  marker: google.maps.Marker;
}

interface BuildingPinEditorProps {
  associationId: string;
  centerLat: number;
  centerLng: number;
  onDone: () => void;
}

// ---- sentinel layer URL ---------------------------------------------------
// hubMapLayers.baseImageUrl is NOT NULL in the DB, so we use this sentinel
// string for layers that represent a Google Maps satellite view rather than an
// uploaded image.
const SATELLITE_LAYER_SENTINEL = "google-maps-satellite";

// ---- CSS animation injected once ------------------------------------------
const PIN_ANIMATION_CSS = `
@keyframes pin-drop {
  0%   { transform: translateY(-40px) scaleY(0.8); opacity: 0; }
  60%  { transform: translateY(4px) scaleY(1.05);  opacity: 1; }
  100% { transform: translateY(0)   scaleY(1);     opacity: 1; }
}
.map-pin-entering {
  animation: pin-drop 0.3s ease-out forwards;
}
`;

function injectPinAnimation() {
  if (document.getElementById("ycm-pin-drop-style")) return;
  const style = document.createElement("style");
  style.id = "ycm-pin-drop-style";
  style.textContent = PIN_ANIMATION_CSS;
  document.head.appendChild(style);
}

// ---- helper: ensure a "satellite" layer exists, return layerId ------------
async function ensureSatelliteLayer(associationId: string): Promise<string> {
  // Fetch existing layers
  const res = await apiRequest(
    "GET",
    `/api/associations/${associationId}/hub/map/layers`,
  );
  const layers = (await res.json()) as Array<{
    id: string;
    baseImageUrl: string;
  }>;
  const existing = layers.find(
    (l) => l.baseImageUrl === SATELLITE_LAYER_SENTINEL,
  );
  if (existing) return existing.id;

  // Create one
  const createRes = await apiRequest(
    "POST",
    `/api/associations/${associationId}/hub/map/layers`,
    {
      name: "Satellite (Google Maps)",
      baseImageUrl: SATELLITE_LAYER_SENTINEL,
      isActive: 1,
    },
  );
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

// ---- component ------------------------------------------------------------

export default function BuildingPinEditor({
  associationId,
  centerLat,
  centerLng,
  onDone,
}: BuildingPinEditorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const layerIdRef = useRef<string | null>(null);

  const [pins, setPins] = useState<PlacedPin[]>([]);
  const [placingMode, setPlacingMode] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingLabel, setPendingLabel] = useState<{
    clientId: string;
    value: string;
  } | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const pinsRef = useRef(pins);
  pinsRef.current = pins;

  injectPinAnimation();

  // ---- init map -----------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const g = await loadGoogleMaps();
        if (cancelled || !g || !mapContainerRef.current) return;

        const map = new g.maps.Map(mapContainerRef.current, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 18,
          mapTypeId: "satellite",
          tilt: 0,
          disableDefaultUI: false,
          gestureHandling: "greedy",
        });
        mapRef.current = map;

        layerIdRef.current = await ensureSatelliteLayer(associationId);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [associationId, centerLat, centerLng]);

  // ---- click handler (drop pin) ------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!placingMode) return;

    const listener = map.addListener(
      "click",
      (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        dropPin(e.latLng.lat(), e.latLng.lng());
      },
    );

    return () => {
      google.maps.event.removeListener(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placingMode]);

  // ---- drop a pin ---------------------------------------------------------
  const dropPin = useCallback(
    (lat: number, lng: number) => {
      const map = mapRef.current;
      if (!map) return;

      const clientId = crypto.randomUUID();

      // Create a marker with the bounce animation class via a custom overlay
      const markerElement = document.createElement("div");
      markerElement.className = "map-pin-entering";
      markerElement.style.cssText = `
        width: 32px; height: 44px; cursor: pointer;
        display: flex; flex-direction: column; align-items: center;
      `;
      markerElement.innerHTML = `
        <svg viewBox="0 0 24 32" width="28" height="36" xmlns="http://www.w3.org/2000/svg" fill="none">
          <path d="M12 0C7.033 0 3 4.033 3 9c0 6.75 9 23 9 23S21 15.75 21 9c0-4.967-4.033-9-9-9z"
                fill="#2563eb" stroke="white" stroke-width="1.5"/>
          <circle cx="12" cy="9" r="4" fill="white"/>
        </svg>
      `;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const marker = new (google.maps as any).Marker({
        position: { lat, lng },
        map,
        icon: " ", // space char — we'll use a custom overlay instead
        draggable: true,
      }) as google.maps.Marker;

      // Wire drag-end to update geometry
      marker.addListener("dragend", () => {
        const pos = marker.getPosition();
        if (!pos) return;
        const updated = pinsRef.current.find((p) => p.clientId === clientId);
        if (!updated?.serverId) return;
        apiRequest(
          "PUT",
          `/api/associations/${associationId}/hub/map/nodes/${updated.serverId}`,
          { geometry: { lat: pos.lat(), lng: pos.lng() } },
        ).catch(() => {
          // silent — drag update is best-effort
        });
      });

      const newPin: PlacedPin = {
        clientId,
        serverId: null,
        lat,
        lng,
        label: "",
        awaitingLabel: true,
        marker,
      };

      setPins((prev) => [...prev, newPin]);
      setPendingLabel({ clientId, value: "" });
      // Exit placing mode after a drop so user can name before placing another
      setPlacingMode(false);
    },
    [associationId],
  );

  // ---- confirm label ------------------------------------------------------
  async function confirmLabel(clientId: string, label: string) {
    if (!label.trim()) return;
    const layerId = layerIdRef.current;
    if (!layerId) return;

    const pin = pinsRef.current.find((p) => p.clientId === clientId);
    if (!pin) return;

    setSavingIds((s) => new Set(s).add(clientId));

    try {
      const res = await apiRequest(
        "POST",
        `/api/associations/${associationId}/hub/map/nodes`,
        {
          layerId,
          nodeType: "building",
          label: label.trim(),
          geometry: { lat: pin.lat, lng: pin.lng },
        },
      );
      const saved = (await res.json()) as { id: string };

      setPins((prev) =>
        prev.map((p) =>
          p.clientId === clientId
            ? { ...p, serverId: saved.id, label: label.trim(), awaitingLabel: false }
            : p,
        ),
      );
    } catch {
      // Remove unsaved pin on failure
      pin.marker.setMap(null);
      setPins((prev) => prev.filter((p) => p.clientId !== clientId));
    } finally {
      setSavingIds((s) => {
        const next = new Set(s);
        next.delete(clientId);
        return next;
      });
      setPendingLabel(null);
    }
  }

  // ---- cancel label input (removes unsaved pin) ---------------------------
  function cancelLabel(clientId: string) {
    const pin = pinsRef.current.find((p) => p.clientId === clientId);
    pin?.marker.setMap(null);
    setPins((prev) => prev.filter((p) => p.clientId !== clientId));
    setPendingLabel(null);
  }

  // ---- delete saved pin --------------------------------------------------
  async function deletePin(clientId: string) {
    const pin = pinsRef.current.find((p) => p.clientId === clientId);
    if (!pin) return;
    pin.marker.setMap(null);
    setPins((prev) => prev.filter((p) => p.clientId !== clientId));

    if (pin.serverId) {
      apiRequest(
        "DELETE",
        `/api/associations/${associationId}/hub/map/nodes/${pin.serverId}`,
      ).catch(() => {
        // best-effort
      });
    }
  }

  // ---- render -------------------------------------------------------------

  const savedPins = pins.filter((p) => !p.awaitingLabel);

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <MapPin className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Could not load the map: {loadError}
        </p>
        <Button variant="outline" onClick={onDone}>
          Skip and finish
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          type="button"
          variant={placingMode ? "default" : "outline"}
          onClick={() => setPlacingMode((v) => !v)}
          disabled={isLoading || !!pendingLabel}
        >
          <MapPin className="h-4 w-4 mr-1.5" />
          {placingMode ? "Click map to drop pin" : "📍 Place Building"}
        </Button>

        {savedPins.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {savedPins.length} building{savedPins.length !== 1 ? "s" : ""} placed
          </span>
        )}

        <Button
          type="button"
          className="ml-auto"
          disabled={savedPins.length === 0}
          onClick={onDone}
        >
          All buildings placed? Done →
        </Button>
      </div>

      {/* Map container — explicit height required by Maps JS API */}
      <div className="relative rounded-xl overflow-hidden border shadow">
        <div
          ref={mapContainerRef}
          style={{ width: "100%", height: "420px" }}
        />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Placing-mode overlay hint */}
        {placingMode && !isLoading && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-full shadow pointer-events-none">
            Click anywhere on the map to drop a pin
          </div>
        )}
      </div>

      {/* Inline label input for pending pin */}
      {pendingLabel && (
        <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2">
          <MapPin className="h-4 w-4 text-primary shrink-0" />
          <Input
            autoFocus
            placeholder="Building name (e.g. Building A)"
            value={pendingLabel.value}
            onChange={(e) =>
              setPendingLabel((p) => p ? { ...p, value: e.target.value } : p)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmLabel(pendingLabel.clientId, pendingLabel.value);
              if (e.key === "Escape") cancelLabel(pendingLabel.clientId);
            }}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            className="h-8 px-2"
            disabled={!pendingLabel.value.trim() || savingIds.has(pendingLabel.clientId)}
            onClick={() => confirmLabel(pendingLabel.clientId, pendingLabel.value)}
          >
            {savingIds.has(pendingLabel.clientId) ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={() => cancelLabel(pendingLabel.clientId)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* List of placed buildings */}
      {savedPins.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            Placed buildings
          </p>
          {savedPins.map((pin) => (
            <div
              key={pin.clientId}
              className="flex items-center gap-2 bg-muted/40 rounded-md px-3 py-2"
            >
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-sm flex-1">{pin.label}</span>
              <button
                type="button"
                onClick={() => deletePin(pin.clientId)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={`Remove ${pin.label}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Skip option */}
      <div className="text-center">
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          Skip building placement for now
        </button>
      </div>
    </div>
  );
}
