/**
 * CommunityMapView — static satellite snapshot variant
 *
 * Shows a satellite image of the community served by the backend proxy
 * (/api/hub/:identifier/static-map) which calls Google Static Maps API
 * server-side. No Maps JS API is loaded on the public hub page.
 */

import { useState } from "react";
import { MapPin, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface CommunityMapViewProps {
  identifier: string; // hub slug or association id
  themeColor?: string;
  buildings?: unknown[]; // kept for interface compatibility; not used by static variant
  mapsQuery?: string; // e.g. "Community Name, City, State" for the Google Maps link
}

export default function CommunityMapView({
  identifier,
  themeColor = "#3b82f6",
  mapsQuery,
}: CommunityMapViewProps) {
  const [imageState, setImageState] = useState<"loading" | "loaded" | "error">(
    "loading",
  );

  const src = `/api/hub/${encodeURIComponent(identifier)}/static-map`;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="h-5 w-5" style={{ color: themeColor }} />
        <h2 className="text-lg font-semibold">Community Map</h2>
      </div>

      <Card className="overflow-hidden">
        <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
          {imageState === "loading" && (
            <Skeleton className="absolute inset-0 rounded-none" />
          )}

          {imageState === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 bg-muted/40">
              <MapPin className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                Map not available yet
              </p>
            </div>
          )}

          <img
            src={src}
            alt="Community satellite view"
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageState === "loaded" ? "opacity-100" : "opacity-0"
            }`}
            loading="lazy"
            onLoad={() => setImageState("loaded")}
            onError={() => setImageState("error")}
          />
        </div>

        {imageState !== "error" && (
          <div className="px-4 py-3 flex items-center justify-end border-t">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery || identifier)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs hover:underline transition-colors"
              style={{ color: themeColor }}
            >
              Open in Google Maps
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </Card>
    </section>
  );
}
