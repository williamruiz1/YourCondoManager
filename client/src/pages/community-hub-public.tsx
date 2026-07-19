// zone: My Community
// persona: Owner
import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { t } from "@/i18n/use-strings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Bell, ExternalLink, Info, ChevronRight, Building2, Phone, MapPin, Calendar, FileText, Download, Mail, KeyRound, Loader2, CheckCircle2, Home, ShieldCheck } from "lucide-react";
import CommunityMapView from "@/components/community-map-view";
import { Pill, type PillTone } from "@/components/redesign";
// The Pill/Tile primitives pull in the canonical @ycm/design-system stylesheet
// (client/src/styles/redesign-kit.css, F1 — founder-os#10187). Every class it
// defines is prefixed `.ds-` and is documented zero-collision with the
// shadcn/Tailwind app shell, so importing it here is safe additive reuse of
// the SAME primitives the Manager app + Owner portal + Owner app render —
// not a re-implementation of them.
import "@/styles/redesign-kit.css";

type PublicBuilding = {
  id: string;
  name: string;
  address: string;
  totalUnits: number | null;
  notes: string | null;
  unitCount: number;
};

type PublicHubData = {
  config: {
    communityDescription: string | null;
    logoUrl: string | null;
    bannerImageUrl: string | null;
    themeColor: string | null;
    sectionOrder: string[];
    enabledSections: string[];
    slug: string | null;
    welcomeModeEnabled: number;
    welcomeHeadline: string | null;
    welcomeHighlights: any;
  };
  association: {
    name: string;
    city: string;
    state: string;
  } | null;
  notices: Array<{
    id: string;
    title: string;
    body: string;
    priority: string;
    publishedAt: string;
    isPinned: number;
    authorName: string | null;
    noticeCategory: string | null;
  }>;
  infoBlocks: Array<{
    id: string;
    category: string;
    title: string;
    body: string | null;
    externalLinks: Array<{ label: string; url: string }>;
  }>;
  actionLinks: Array<{
    id: string;
    label: string;
    iconKey: string | null;
    routeType: string;
    routeTarget: string;
  }>;
  meetings: Array<{
    id: string;
    title: string;
    meetingType: string;
    scheduledAt: string;
    location: string | null;
  }>;
  documents: Array<{
    id: string;
    title: string;
    documentType: string;
    fileUrl: string;
    createdAt: string;
  }>;
};

const CATEGORY_ICONS: Record<string, typeof Info> = {
  trash: Info,
  parking: MapPin,
  emergency: Bell,
  maintenance: Info,
  rules: Info,
  amenities: Info,
  custom: Info,
};

// --- Brand-aligned aesthetic tokens ------------------------------------------
// Headings use Inter Tight — the canonical @ycm/design-system (F1,
// founder-os#10187) heading typeface, already loaded in client/index.html.
const BRAND_FONT = '"Inter Tight", Inter, system-ui, sans-serif';
// Palette is the exact @ycm/design-system token set (client/src/styles/
// redesign-kit.css --ds-*) — same hex values, kept as local constants so the
// per-community `themeColor` override composes cleanly with the fixed
// neutrals (ink/muted/line/pageBg) that never change per-community.
const V4 = {
  teal: "#014d4a",
  teal700: "#0a6a63",
  accent: "#15a39c",
  ink: "#0f2e2c",
  muted: "#5b7572",
  line: "#e3edeb",
  pageBg: "#f5f7f9",
} as const;

// Shared section-heading pattern — a teal icon chip + a brand-font title.
// Defined once so every section renders identically.
function SectionHeading({ icon: Icon, title, themeColor }: { icon: typeof Info; title: string; themeColor: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
        style={{ backgroundColor: `${themeColor}14`, color: themeColor }}
        aria-hidden="true"
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <h2 className="text-xl font-semibold tracking-tight" style={{ fontFamily: BRAND_FONT, color: V4.ink }}>
        {title}
      </h2>
    </div>
  );
}

// Shared card chrome — DS-exact radius (12px) + DS-exact shadow token, with a
// slightly deeper hover shadow for interactivity. Applied via className so no
// card logic changes.
const CARD_V4 = "rounded-xl border shadow-[0_1px_3px_rgba(1,77,74,0.04)] transition-shadow hover:shadow-md";
const cardBorder = { borderColor: V4.line } as const;

// A branded pill button — same shape/weight/radius language as the shared
// @ycm/design-system `.ds-btn`, expressed with plain Tailwind + inline color
// overrides so it never fights the DS stylesheet's own `:hover` cascade.
const BTN_V4 = "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-bold text-white transition-colors";

const PRIORITY_TONE: Record<string, PillTone> = {
  urgent: "bad",
  important: "warn",
  normal: "muted",
};

export default function CommunityHubPublicPage() {
  useDocumentTitle(t("communityHubPublic.title"));
  const [, params] = useRoute("/community/:identifier");
  const identifier = params?.identifier || "";
  const [noticeCategory, setNoticeCategory] = useState<string>("all");

  const { data: hub, isLoading, error } = useQuery<PublicHubData>({
    queryKey: [`/api/hub/${identifier}/public`],
    enabled: !!identifier,
    queryFn: async () => {
      const res = await fetch(`/api/hub/${encodeURIComponent(identifier)}/public`);
      if (!res.ok) throw new Error("Hub not found");
      return res.json();
    },
  });

  const { data: buildingsData } = useQuery<{ buildings: PublicBuilding[]; unlinkedUnitCount: number }>({
    queryKey: [`/api/hub/${identifier}/buildings`],
    enabled: !!identifier && !!hub,
    queryFn: async () => {
      const res = await fetch(`/api/hub/${encodeURIComponent(identifier)}/buildings`);
      if (!res.ok) return { buildings: [], unlinkedUnitCount: 0 };
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div role="status" aria-label={t("common.loading")} className="min-h-screen flex items-center justify-center" style={{ backgroundColor: V4.pageBg }}>
        <div className="animate-pulse text-muted-foreground motion-reduce:animate-none">{t("communityHubPublic.loading")}</div>
      </div>
    );
  }

  if (error || !hub) {
    return (
      <main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: V4.pageBg }}>
        <Card className={`max-w-md w-full ${CARD_V4}`} style={cardBorder}>
          <CardContent className="pt-6 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-xl font-semibold mb-2" style={{ fontFamily: BRAND_FONT, color: V4.ink }}>{t("communityHubPublic.error.title")}</h1>
            <p className="text-muted-foreground">{t("communityHubPublic.error.body")}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { config, association, notices, infoBlocks, actionLinks, meetings = [], documents: docs = [] } = hub;
  // Brand teal default (was a generic blue #3b82f6 — the "blue tint" on the
  // community page). A community can still override via config.themeColor.
  const themeColor = config.themeColor || "#014D4A";
  const enabledSections = config.enabledSections || [];
  const sectionOrder = config.sectionOrder || ["notices", "quick-actions", "info-blocks", "map", "contacts"];
  const publicBuildings = buildingsData?.buildings || [];
  const sectionSpan: Record<string, string> = {
    notices: "lg:col-span-12",
    "quick-actions": "lg:col-span-12",
    "info-blocks": "lg:col-span-12",
    events: "lg:col-span-7",
    documents: "lg:col-span-5",
    map: "lg:col-span-12",
    buildings: "lg:col-span-12",
    contacts: "lg:col-span-12",
  };

  const totalUnits = publicBuildings.reduce((sum, b) => sum + (b.unitCount || 0), 0);

  // Section rendering engine — renders sections in configurable order
  const sectionRenderers: Record<string, () => React.ReactNode> = {
    notices: () => <NoticesSection notices={notices} themeColor={themeColor} activeCategory={noticeCategory} onCategoryChange={setNoticeCategory} />,
    "quick-actions": () => <QuickActionsSection actionLinks={actionLinks} themeColor={themeColor} />,
    "info-blocks": () => <InfoBlocksSection infoBlocks={infoBlocks} themeColor={themeColor} />,
    buildings: () => publicBuildings.length > 0 ? <BuildingsSection buildings={publicBuildings} themeColor={themeColor} /> : null,
    events: () => meetings.length > 0 ? (
      <section>
        <SectionHeading icon={Calendar} title="Upcoming Events" themeColor={themeColor} />
        <div className="space-y-3">
          {meetings.map((m) => (
            <Card key={m.id} className={CARD_V4} style={cardBorder}>
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm" style={{ color: V4.ink }}>{m.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.meetingType}{m.location ? ` — ${m.location}` : ""}</p>
                  </div>
                  <Pill tone="muted">{new Date(m.scheduledAt).toLocaleDateString()}</Pill>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    ) : null,
    documents: () => docs.length > 0 ? (
      <section>
        <SectionHeading icon={FileText} title="Key Documents" themeColor={themeColor} />
        <div className="space-y-3">
          {docs.map((doc) => (
            <Card key={doc.id} className={CARD_V4} style={cardBorder}>
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm" style={{ color: V4.ink }}>{doc.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{doc.documentType}</p>
                  </div>
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="rounded-lg" style={{ color: themeColor }}><Download className="h-4 w-4" /></Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    ) : null,
    map: () => (
      <CommunityMapView
        identifier={identifier}
        themeColor={themeColor}
        buildings={publicBuildings}
        mapsQuery={
          association
            ? [association.name, association.city, association.state]
                .filter(Boolean)
                .join(", ")
            : identifier
        }
      />
    ),
    contacts: () => <ContactsSection association={association} themeColor={themeColor} />,
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: V4.pageBg }}>
      {/* Brand nav — a slim top accent rule (the same teal→accent gradient
          used across every DS surface), the real BrandMark + the
          YourCondoManager wordmark spelled out (not just an icon), and the
          community name — so the page is unmistakably a YourCondoManager
          product from the first pixel, not a footer-only brand touch. */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm" style={{ borderBottom: `1px solid ${V4.line}` }}>
        <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${V4.teal}, ${V4.accent})` }} aria-hidden="true" />
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark className="h-7 w-7 shrink-0" />
            <div className="min-w-0 leading-tight">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.09em] truncate" style={{ color: V4.accent }}>
                YourCondoManager
              </p>
              <p className="font-semibold text-sm truncate" style={{ fontFamily: BRAND_FONT, color: V4.ink }}>
                {association?.name || "Community Hub"}
              </p>
            </div>
          </div>
          <a
            href="#owner-signin"
            className={`${BTN_V4} shrink-0 hover:bg-[var(--nav-cta-hover)]`}
            style={{ backgroundColor: themeColor, ["--nav-cta-hover" as any]: V4.teal700 }}
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            Owner Portal
          </a>
        </div>
      </nav>

      {/* Hero Banner */}
      <header
        className="relative overflow-hidden"
        style={{
          background: config.bannerImageUrl
            ? `linear-gradient(rgba(1,77,74,0.55), rgba(1,77,74,0.78)), url(${config.bannerImageUrl}) center/cover`
            : `linear-gradient(135deg, ${themeColor} 0%, ${themeColor} 45%, ${themeColor}cc 100%)`,
        }}
      >
        {/* soft accent glow for depth */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full blur-3xl opacity-30"
          style={{ background: "#15A39C" }}
        />
        <div className="relative max-w-5xl mx-auto px-4 py-12 sm:py-20">
          <div className="grid gap-9 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-center">
            <div>
              <p className="text-white/70 text-[11px] font-bold uppercase tracking-[0.14em] mb-4 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Official community page
              </p>
              <div className="flex items-center gap-4 mb-5">
                {config.logoUrl && (
                  <img
                    src={config.logoUrl}
                    alt={association?.name || "Community"}
                    className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl object-cover bg-white/95 p-1.5 shrink-0 shadow-lg ring-1 ring-white/30"
                  />
                )}
                <div className="min-w-0">
                  <h1
                    className="text-3xl sm:text-5xl font-bold text-white tracking-[-0.035em] leading-[1.03]"
                    style={{ fontFamily: BRAND_FONT }}
                  >
                    {association?.name || "Community Hub"}
                  </h1>
                  {association && (
                    <p className="text-white/85 text-sm sm:text-base mt-2 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {association.city}, {association.state}
                    </p>
                  )}
                </div>
              </div>
              {config.communityDescription && (
                <p className="text-white/90 max-w-2xl text-sm sm:text-lg leading-relaxed">
                  {config.communityDescription}
                </p>
              )}
            </div>

            <aside className="rounded-2xl border border-white/20 bg-white/10 p-5 text-white shadow-2xl backdrop-blur-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/65">
                Community at a glance
              </p>
              <dl className="mt-4 divide-y divide-white/15">
                {association && (
                  <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
                    <dt className="text-sm text-white/70">Location</dt>
                    <dd className="text-sm font-bold text-right">{association.city}, {association.state}</dd>
                  </div>
                )}
                {publicBuildings.length > 0 && (
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm text-white/70">Buildings</dt>
                    <dd className="text-sm font-bold">{publicBuildings.length}</dd>
                  </div>
                )}
                {totalUnits > 0 && (
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm text-white/70">Residences</dt>
                    <dd className="text-sm font-bold">{totalUnits}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-sm text-white/70">Management</dt>
                  <dd className="text-sm font-bold">Owner portal</dd>
                </div>
              </dl>
              <a
                href="#owner-signin"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold transition-colors hover:bg-white/90"
                style={{ color: themeColor }}
              >
                Sign in to the owner portal
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </aside>
          </div>
        </div>
        {/* base accent rule */}
        <div className="h-1 w-full" style={{ background: "#15A39C" }} aria-hidden="true" />
      </header>

      <main id="main-content" tabIndex={-1} className="max-w-5xl mx-auto px-4 pb-8 pt-8 sm:pt-10">
        {/* Welcome Mode */}
        {config.welcomeModeEnabled === 1 && config.welcomeHeadline && (
          <Card className={`${CARD_V4} border`} style={{ borderColor: `${themeColor}33`, background: `linear-gradient(180deg, ${themeColor}0a, transparent)` }}>
            <CardContent className="pt-6 pb-5 px-6">
              <h2 className="text-xl font-semibold mb-3 tracking-tight" style={{ fontFamily: BRAND_FONT, color: V4.ink }}>{config.welcomeHeadline}</h2>
              {Array.isArray(config.welcomeHighlights) && config.welcomeHighlights.length > 0 && (
                <ul className="space-y-2.5">
                  {config.welcomeHighlights.map((highlight: string, i: number) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: V4.muted }}>
                      <ChevronRight className="h-4 w-4 mt-0.5 shrink-0" style={{ color: themeColor }} />
                      {highlight}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* The configured order remains authoritative, while the 12-column
            editorial grid gives notices, resources, maps, and contacts a
            deliberate hierarchy instead of one long stack. */}
        <div className="grid gap-7 lg:grid-cols-12 lg:gap-8">
          {sectionOrder
            .filter((section) => enabledSections.includes(section))
            .map((section) => {
              const renderer = sectionRenderers[section];
              if (!renderer) return null;
              const content = renderer();
              if (!content) return null;
              return (
                <div key={section} className={sectionSpan[section] || "lg:col-span-12"}>
                  {content}
                </div>
              );
            })}
        </div>

        {/* Empty state when no sections have content */}
        {sectionOrder.filter(s => enabledSections.includes(s)).every(s => {
          if (s === "notices" && notices.length === 0) return true;
          if (s === "quick-actions" && actionLinks.length === 0) return true;
          if (s === "info-blocks" && infoBlocks.length === 0) return true;
          if (s === "events" && meetings.length === 0) return true;
          if (s === "documents" && docs.length === 0) return true;
          if (s === "buildings" && publicBuildings.length === 0) return true;
          if (s === "map") return false; // static map always renders (shows placeholder on error)
          if (s === "contacts") return false;
          return false;
        }) && (
          <Card className={CARD_V4} style={cardBorder}>
            <CardContent className="py-12 text-center">
              <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">This community hub is being set up. Check back soon for updates.</p>
            </CardContent>
          </Card>
        )}

        {/* Authenticate CTA — anchor target for the nav's "Owner Portal" CTA */}
        <div id="owner-signin" className="scroll-mt-20 mt-10 space-y-6 sm:space-y-8">
          <Separator />
          <HubAuthSection themeColor={themeColor} />
        </div>
      </main>

      {/* Footer — full brand lockup + legal links, so the page reads as a
          real product surface end-to-end, not a one-line "powered by". */}
      <footer className="border-t bg-white py-8 mt-10" style={{ borderColor: V4.line }}>
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <BrandMark decorative className="h-7 w-7" />
            <div className="leading-tight">
              <p className="font-semibold text-sm" style={{ fontFamily: BRAND_FONT, color: V4.ink }}>YourCondoManager</p>
              <p className="text-xs" style={{ color: V4.muted }}>Community management, handled in one place.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs" style={{ color: V4.muted }}>
            <a href="/privacy" className="hover:underline" style={{ color: V4.muted }}>Privacy</a>
            <a href="/terms" className="hover:underline" style={{ color: V4.muted }}>Terms</a>
            <span>© {new Date().getFullYear()} YourCondoManager</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- Section Components ---

function NoticesSection({
  notices,
  themeColor,
  activeCategory,
  onCategoryChange,
}: {
  notices: PublicHubData["notices"];
  themeColor: string;
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
}) {
  if (notices.length === 0) return null;

  const usedCategories = Array.from(new Set(notices.map((n) => n.noticeCategory).filter(Boolean))) as string[];
  const filteredNotices = activeCategory === "all"
    ? notices
    : notices.filter((n) => n.noticeCategory === activeCategory || (!n.noticeCategory && activeCategory === "general"));

  return (
    <section>
      <SectionHeading icon={Bell} title="Notices & Announcements" themeColor={themeColor} />
      {usedCategories.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={() => onCategoryChange("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${activeCategory === "all" ? "text-white border-transparent" : "bg-white text-gray-600 hover:border-gray-300"}`}
            style={activeCategory === "all" ? { backgroundColor: themeColor, borderColor: themeColor } : { borderColor: V4.line }}
          >
            All
          </button>
          {usedCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize ${activeCategory === cat ? "text-white border-transparent" : "bg-white text-gray-600 hover:border-gray-300"}`}
              style={activeCategory === cat ? { backgroundColor: themeColor, borderColor: themeColor } : { borderColor: V4.line }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {filteredNotices.map((notice) => (
          <Card
            key={notice.id}
            className={`${CARD_V4} h-full ${notice.isPinned ? "border-l-[3px]" : ""}`}
            style={notice.isPinned ? { ...cardBorder, borderLeftColor: themeColor } : cardBorder}
          >
            <CardContent className="flex h-full flex-col pt-5 pb-4 px-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  {notice.isPinned === 1 && <Pill tone="info">Pinned</Pill>}
                  <Pill tone={PRIORITY_TONE[notice.priority] || "muted"}>{notice.priority}</Pill>
                  {notice.noticeCategory && notice.noticeCategory !== "general" && (
                    <Pill tone="muted">{notice.noticeCategory}</Pill>
                  )}
                </div>
                <h3 className="font-semibold text-[15px]" style={{ color: V4.ink }}>{notice.title}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-line leading-relaxed">{notice.body}</p>
              </div>
              <div className="flex items-center gap-3 mt-auto pt-3 border-t text-xs text-muted-foreground" style={{ borderColor: V4.line }}>
                {notice.authorName && <span>By {notice.authorName}</span>}
                {notice.publishedAt && (
                  <span>{new Date(notice.publishedAt).toLocaleDateString()}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function QuickActionsSection({ actionLinks, themeColor }: { actionLinks: PublicHubData["actionLinks"]; themeColor: string }) {
  if (actionLinks.length === 0) return null;

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4 tracking-tight" style={{ fontFamily: BRAND_FONT, color: V4.ink }}>Quick Actions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {actionLinks.map((link) => (
          <a
            key={link.id}
            href={link.routeTarget}
            target={link.routeType === "external" ? "_blank" : undefined}
            rel={link.routeType === "external" ? "noopener noreferrer" : undefined}
            className="group"
          >
            <Card
              className={`${CARD_V4} cursor-pointer h-full bg-white group-hover:border-[var(--qa-accent)]`}
              style={{ ...cardBorder, ["--qa-accent" as any]: themeColor }}
            >
              <CardContent className="flex flex-col items-center justify-center text-center p-5 min-h-[88px] gap-1.5">
                <span className="font-medium text-sm transition-colors group-hover:text-[var(--qa-accent)]" style={{ color: V4.ink }}>{link.label}</span>
                {link.routeType === "external" && (
                  <ExternalLink className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-[var(--qa-accent)]" />
                )}
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </section>
  );
}

function InfoBlocksSection({ infoBlocks, themeColor }: { infoBlocks: PublicHubData["infoBlocks"]; themeColor: string }) {
  if (infoBlocks.length === 0) return null;

  return (
    <section>
      <SectionHeading icon={Info} title="Community Information" themeColor={themeColor} />
      <div className="grid gap-3 sm:grid-cols-2">
        {infoBlocks.map((block) => {
          const IconComp = CATEGORY_ICONS[block.category] || Info;
          return (
            <Card key={block.id} className={CARD_V4} style={cardBorder}>
              <CardHeader className="pb-2 pt-5 px-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: `${themeColor}14`, color: themeColor }} aria-hidden="true">
                    <IconComp className="h-4 w-4" />
                  </span>
                  <CardTitle className="text-base" style={{ color: V4.ink }}>{block.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-5 pb-5">
                {block.body && (
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{block.body}</p>
                )}
                {block.externalLinks?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {block.externalLinks.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm flex items-center gap-1 hover:underline"
                        style={{ color: themeColor }}
                      >
                        <ExternalLink className="h-3 w-3" />
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function BuildingsSection({ buildings, themeColor }: { buildings: PublicBuilding[]; themeColor: string }) {
  if (buildings.length === 0) return null;

  return (
    <section>
      <SectionHeading icon={Building2} title="Buildings" themeColor={themeColor} />
      <div className="grid gap-3 sm:grid-cols-2">
        {buildings.map((building) => (
          <Card key={building.id} className={CARD_V4} style={cardBorder}>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0 mt-0.5" style={{ backgroundColor: `${themeColor}14`, color: themeColor }} aria-hidden="true">
                  <Home className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-sm" style={{ color: V4.ink }}>{building.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {building.address}
                  </p>
                  {building.unitCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{building.unitCount} unit{building.unitCount !== 1 ? "s" : ""}</p>
                  )}
                  {building.notes && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{building.notes}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function ContactsSection({ association, themeColor }: { association: PublicHubData["association"]; themeColor: string }) {
  if (!association) return null;

  return (
    <section>
      <SectionHeading icon={Phone} title="Contact & Key Information" themeColor={themeColor} />
      <Card className={CARD_V4} style={cardBorder}>
        <CardContent className="pt-5 pb-5 px-5">
          <div className="space-y-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0" style={{ backgroundColor: `${themeColor}14`, color: themeColor }} aria-hidden="true">
                <Building2 className="h-[18px] w-[18px]" />
              </span>
              <div>
                <p className="font-medium text-sm" style={{ color: V4.ink }}>{association.name}</p>
                <p className="text-xs text-muted-foreground">{association.city}, {association.state}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For inquiries, please contact your property management office or sign in to the resident portal.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function HubAuthSection({ themeColor }: { themeColor: string }) {
  const [step, setStep] = useState<"idle" | "email" | "pin" | "success">("idle");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [simulatedOtp, setSimulatedOtp] = useState<string | null>(null);

  async function handleRequestPin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portal/request-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send code");
      if (data.simulatedOtp) setSimulatedOtp(data.simulatedOtp);
      setStep("pin");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyPin(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portal/verify-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: pin.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid code");
      if (data.portalAccessId) {
        setStep("success");
        setTimeout(() => {
          window.location.href = `/portal?portalAccessId=${data.portalAccessId}`;
        }, 1000);
      } else if (data.associations) {
        // Multiple associations — redirect to portal with email for picker
        setStep("success");
        setTimeout(() => {
          window.location.href = `/portal?email=${encodeURIComponent(email)}`;
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (step === "idle") {
    return (
      <section className="text-center py-6">
        <p className="text-muted-foreground text-sm mb-4">
          Are you a resident? Sign in for full access to documents, requests, and more.
        </p>
        <button type="button" className={`${BTN_V4} shadow-sm hover:shadow-md`} style={{ backgroundColor: themeColor }} onClick={() => setStep("email")}>
          <Mail className="h-4 w-4" aria-hidden="true" />
          Sign In with Email
        </button>
      </section>
    );
  }

  if (step === "success") {
    return (
      <section className="text-center py-6">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2" style={{ color: themeColor }} />
        <p className="text-sm font-medium">Verified! Redirecting to your portal...</p>
      </section>
    );
  }

  return (
    <section className="py-6">
      <Card className={`max-w-sm mx-auto ${CARD_V4}`} style={cardBorder}>
        <CardContent className="pt-6 pb-5 px-6">
          {step === "email" ? (
            <form onSubmit={handleRequestPin} className="space-y-3">
              <div className="text-center mb-3">
                <Mail className="h-6 w-6 mx-auto mb-1.5" style={{ color: themeColor }} />
                <p className="text-sm font-medium">Enter your email to sign in</p>
                <p className="text-xs text-muted-foreground">We'll send a one-time code to verify your identity.</p>
              </div>
              <Input
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button type="submit" className={`${BTN_V4} w-full`} style={{ backgroundColor: themeColor }} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Code"}
              </button>
              <button type="button" className="w-full text-xs text-muted-foreground hover:text-foreground" onClick={() => setStep("idle")}>
                Cancel
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyPin} className="space-y-3">
              <div className="text-center mb-3">
                <KeyRound className="h-6 w-6 mx-auto mb-1.5" style={{ color: themeColor }} />
                <p className="text-sm font-medium">Enter your verification code</p>
                <p className="text-xs text-muted-foreground">
                  Sent to <strong>{email}</strong>
                </p>
                {simulatedOtp && (
                  <p className="text-xs text-amber-600 mt-1">Demo mode — code: <strong>{simulatedOtp}</strong></p>
                )}
              </div>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Enter 6-digit code"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={6}
                required
                autoFocus
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button type="submit" className={`${BTN_V4} w-full`} style={{ backgroundColor: themeColor }} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Sign In"}
              </button>
              <button type="button" className="w-full text-xs text-muted-foreground hover:text-foreground" onClick={() => { setStep("email"); setPin(""); setError(""); }}>
                Use a different email
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
