// zone: My Community
// persona: Owner
//
// 3.5 Q6 (pre-resolved by 4.2 Q4 Session B, 2026-04-24) — /portal/community
// is a thin zone-wrapper link-out card to `/community/:associationId`, NOT
// an inline preview of notices/events/posts. The hub points owners to
// the public community hub and surfaces the secondary portal sub-zones
// (Amenities, Notices, Documents) in one place.

import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card, CardContent } from "@/components/ui/card";
import { PortalShell, usePortalContext } from "./portal-shell";
import "@/styles/portal-redesign.css";

function CommunityHubContent() {
  const { associationId, associationName, portalFetch, session } = usePortalContext();

  const { data: amenitiesSettings } = useQuery<{ amenitiesEnabled: boolean }>({
    queryKey: ["portal/amenities-settings", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/amenities/settings");
      if (!res.ok) return { amenitiesEnabled: false };
      return res.json();
    },
  });

  return (
    <div className="pfx-scope mx-auto flex max-w-4xl flex-col gap-6" data-testid="portal-community">
      <div className="pfx-pagehead">
        <p className="pfx-eyebrow">Association</p>
        <h1 data-testid="portal-community-heading">
          My Community
        </h1>
        <p className="pfx-lede">
          Shortcuts to your community hub, notices, amenities, and shared documents.
        </p>
      </div>

      <Card style={{ borderRadius: "var(--ds-radius, 12px)", boxShadow: "var(--ds-shadow, 0 1px 3px rgba(1,77,74,.04))" }}>
        <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between" data-testid="portal-community-hub-link">
          <div>
            <p className="pfx-eyebrow">Public community hub</p>
            <p className="mt-1 font-headline text-xl">
              {associationName ? `${associationName}'s community hub` : "Open your community hub"}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--ds-sub, #4a6b68)" }}>
              Event calendars, announcements, and public resources live on your community's public page. Clicking
              through opens a new tab — your portal session stays signed in here.
            </p>
          </div>
          {associationId ? (
            <a
              href={`/community/${associationId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white"
              style={{ background: "var(--ds-teal, #014d4a)" }}
              data-testid="portal-community-hub-button"
            >
              Open hub
              <span className="material-symbols-outlined text-base">open_in_new</span>
            </a>
          ) : (
            <p className="text-xs" style={{ color: "var(--ds-sub, #4a6b68)" }}>Your association is not configured for a public hub yet.</p>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3" data-testid="portal-community-shortcuts">
        <Link
          href="/portal/notices"
          className="pfx-shortcut"
          data-testid="portal-community-shortcut-notices"
        >
          <p className="pfx-eyebrow">Inbox</p>
          <h3>Notices &amp; votes</h3>
          <p>
            Announcements, property notices, and any open ballots or elections.
          </p>
        </Link>
        {amenitiesSettings?.amenitiesEnabled ? (
          <Link
            href="/portal/amenities"
            className="pfx-shortcut"
            data-testid="portal-community-shortcut-amenities"
          >
            <p className="pfx-eyebrow">Amenities</p>
            <h3>Reserve a space</h3>
            <p>Book amenities and manage your upcoming reservations.</p>
          </Link>
        ) : (
          <Card style={{ borderRadius: "var(--ds-radius, 12px)", boxShadow: "var(--ds-shadow, 0 1px 3px rgba(1,77,74,.04))" }}>
            <CardContent className="py-5" data-testid="portal-community-shortcut-amenities-disabled">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Amenities</p>
              <p className="mt-2 font-headline text-lg">Not enabled</p>
              <p className="mt-1 text-xs" style={{ color: "var(--ds-sub, #4a6b68)" }}>
                Your association has not enabled amenity booking. Contact your manager if you have questions.
              </p>
            </CardContent>
          </Card>
        )}
        <Link
          href="/portal/documents"
          className="pfx-shortcut"
          data-testid="portal-community-shortcut-documents"
        >
          <p className="pfx-eyebrow">Documents</p>
          <h3>Association documents</h3>
          <p>CC&amp;Rs, bylaws, meeting minutes, and more.</p>
        </Link>
      </section>
    </div>
  );
}

export default function PortalCommunityPage() {
  useDocumentTitle("My Community");
  return (
    <PortalShell>
      <CommunityHubContent />
    </PortalShell>
  );
}

export { CommunityHubContent };
