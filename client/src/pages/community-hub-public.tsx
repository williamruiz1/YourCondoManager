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
import { Bell, ExternalLink, Info, ChevronRight, Building2, MapPin, Calendar, FileText, Download, Mail, KeyRound, Home, ShieldCheck, Users, Landmark, WalletCards, Wrench, BookOpen } from "lucide-react";
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
    address: string;
    city: string;
    state: string;
  } | null;
  boardContacts: Array<{
    id: string;
    role: string;
    firstName: string;
    lastName: string;
  }>;
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
const DISPLAY_FONT = '"Source Serif 4", Georgia, serif';
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

  const { config, association, boardContacts = [], notices, infoBlocks, actionLinks, meetings = [], documents: docs = [] } = hub;
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
    contacts: () => <ContactsSection association={association} boardContacts={boardContacts} themeColor={themeColor} />,
  };

  const professionalInquiryHref = association
    ? `mailto:support@yourcondomanager.org?subject=${encodeURIComponent(`${association.name}: official document request`)}`
    : "mailto:support@yourcondomanager.org?subject=Official%20document%20request";

  return (
    <div className="min-h-screen" style={{ backgroundColor: V4.pageBg, fontFamily: BRAND_FONT }}>
      <nav className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur-md" style={{ borderColor: V4.line }}>
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-5 px-5 sm:px-6">
          <a href="#main-content" className="flex min-w-0 items-center gap-3" aria-label={`${association?.name || "Community"} home`}>
            <BrandMark className="h-8 w-8 shrink-0" />
            <div className="min-w-0 leading-tight">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: V4.accent }}>YourCondoManager</p>
              <p className="truncate text-[15px] font-semibold" style={{ color: V4.ink }}>{association?.name || "Community Hub"}</p>
            </div>
          </a>
          <div className="hidden items-center gap-6 text-[13px] font-semibold lg:flex" style={{ color: V4.muted }}>
            <a href="#about" className="transition-colors hover:text-[#014d4a]">About</a>
            <a href="#updates" className="transition-colors hover:text-[#014d4a]">Community</a>
            <a href="#board" className="transition-colors hover:text-[#014d4a]">Board</a>
            <a href="#documents" className="transition-colors hover:text-[#014d4a]">Documents</a>
            <a href="#contact" className="transition-colors hover:text-[#014d4a]">Contact</a>
          </div>
          <a href="/portal" className={`${BTN_V4} shrink-0 px-5 py-2.5`} style={{ backgroundColor: themeColor }}>
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            Owner Portal
          </a>
        </div>
      </nav>

      <header
        className="relative overflow-hidden text-white"
        style={{
          background: config.bannerImageUrl
            ? `linear-gradient(110deg, rgba(0,52,50,.96), rgba(1,77,74,.78)), url(${config.bannerImageUrl}) center/cover`
            : `linear-gradient(122deg, #003432 0%, ${themeColor} 62%, #075f5a 100%)`,
        }}
      >
        <div className="pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full bg-[#2DBDB0]/25 blur-[100px]" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:py-24">
          <div>
            <p className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/65">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Official community page
            </p>
            <h1 className="max-w-3xl text-[42px] font-semibold leading-[.98] tracking-[-0.035em] sm:text-[58px]" style={{ fontFamily: DISPLAY_FONT }}>
              Welcome to {association?.name || "our community"}
            </h1>
            {association && (
              <p className="mt-5 flex items-center gap-2 text-sm font-medium text-white/75">
                <MapPin className="h-4 w-4" aria-hidden="true" /> {association.city}, {association.state}{totalUnits > 0 ? ` · ${totalUnits} residences` : ""}
              </p>
            )}
            <p className="mt-6 max-w-2xl text-[16px] leading-7 text-white/78 sm:text-[17px]">
              A self-managed residential community where owners can stay informed and handle dues, documents, and requests through one secure portal.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/portal" className="inline-flex items-center gap-2 rounded-lg bg-[#2DBDB0] px-6 py-3.5 text-sm font-bold text-[#003432] shadow-lg transition-transform hover:-translate-y-0.5">
                Open Owner Portal <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a href="#board" className="inline-flex items-center rounded-lg border border-white/30 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/10">
                Contact the board
              </a>
            </div>
          </div>

          <aside className="relative rounded-2xl border border-white/30 bg-white p-6 text-[#13201e] shadow-[0_26px_70px_rgba(0,0,0,.28)] sm:p-7">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <BrandMark decorative className="h-7 w-7" />
                <p className="font-semibold text-[#014D4A]" style={{ fontFamily: DISPLAY_FONT }}>Owner Portal</p>
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#6b817e]">Secure access</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <PortalPreviewItem icon={WalletCards} label="Dues & payments" />
              <PortalPreviewItem icon={Wrench} label="Service requests" />
              <PortalPreviewItem icon={BookOpen} label="Documents" />
              <PortalPreviewItem icon={Bell} label="Community notices" />
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-[#e3edeb] bg-[#f8fbfa] p-4">
              <div>
                <p className="text-sm font-semibold text-[#13201e]">Your association account</p>
                <p className="mt-0.5 text-xs text-[#5c726f]">Private, unit-specific information</p>
              </div>
              <span className="rounded-full bg-[#dff4f1] px-3 py-1.5 text-xs font-bold text-[#014D4A]">Sign in</span>
            </div>
          </aside>
        </div>
        <div className="h-1 bg-[#2DBDB0]" aria-hidden="true" />
      </header>

      <main id="main-content" tabIndex={-1}>
        <section id="about" className="bg-white py-16 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-6 lg:grid-cols-[1.25fr_.75fr] lg:items-start">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#15A39C]">About the community</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight text-[#014D4A] sm:text-4xl" style={{ fontFamily: DISPLAY_FONT }}>
                Clear information for owners and the professionals who support them.
              </h2>
              <div className="mt-6 space-y-4 text-[15px] leading-7 text-[#33514d]">
                <p>{config.communityDescription || `${association?.name || "This community"} is a residential condominium community.`}</p>
                <p>Owners use the secure Owner Portal for account balances, payments, governing documents, and service requests. Lenders, insurers, buyers, and closing professionals can use the official inquiry paths below.</p>
                <p>This public page is the association’s front door. Private owner and unit information remains inside the Owner Portal.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-[#e3edeb] bg-[#f8fbfa] p-7">
              <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#014D4A]">Community facts</p>
              <dl className="mt-5 divide-y divide-[#dfe9e7]">
                {totalUnits > 0 && <FactRow label="Residences" value={String(totalUnits)} />}
                {publicBuildings.length > 0 && <FactRow label="Buildings" value={String(publicBuildings.length)} />}
                {association && <FactRow label="Location" value={`${association.city}, ${association.state}`} />}
                <FactRow label="Management" value="Self-managed" />
              </dl>
            </div>
          </div>
        </section>

        <section id="updates" className="scroll-mt-20 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            {config.welcomeModeEnabled === 1 && config.welcomeHeadline && (
              <Card className={`${CARD_V4} mb-8 border`} style={{ borderColor: `${themeColor}33`, background: `linear-gradient(180deg, ${themeColor}0a, transparent)` }}>
                <CardContent className="px-6 pb-5 pt-6">
                  <h2 className="mb-3 text-xl font-semibold tracking-tight" style={{ fontFamily: DISPLAY_FONT, color: V4.ink }}>{config.welcomeHeadline}</h2>
                  {Array.isArray(config.welcomeHighlights) && config.welcomeHighlights.length > 0 && (
                    <ul className="space-y-2.5">
                      {config.welcomeHighlights.map((highlight: string, i: number) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: V4.muted }}>
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" style={{ color: themeColor }} />{highlight}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
            <div className="grid gap-8 lg:grid-cols-12">
              {sectionOrder
                .filter((section) => section !== "contacts" && enabledSections.includes(section))
                .map((section) => {
                  const renderer = sectionRenderers[section];
                  if (!renderer) return null;
                  const content = renderer();
                  if (!content) return null;
                  return <div key={section} className={sectionSpan[section] || "lg:col-span-12"}>{content}</div>;
                })}
            </div>
          </div>
        </section>

        <section id="board" className="scroll-mt-20 border-y border-[#e3edeb] bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <p className="mb-3 text-center text-[11px] font-extrabold uppercase tracking-[.16em] text-[#15A39C]">Board & association contacts</p>
            {association && <ContactsSection association={association} boardContacts={boardContacts} themeColor={themeColor} />}
          </div>
        </section>

        <section id="documents" className="scroll-mt-20 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <div className="grid gap-8 overflow-hidden rounded-[28px] bg-[#003432] p-8 text-white shadow-[0_20px_55px_rgba(0,52,50,.16)] sm:p-11 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#2DBDB0]"><ShieldCheck className="h-4 w-4" /> For lenders, insurers & closings</p>
                <h2 className="mt-3 text-3xl font-semibold" style={{ fontFamily: DISPLAY_FONT }}>Need official association documents?</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">Request resale information, questionnaires, governing records, or insurance documentation through the association’s official channel. Account-specific records are never posted publicly.</p>
              </div>
              <a href={professionalInquiryHref} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-4 text-sm font-bold text-[#014D4A] shadow-lg transition-transform hover:-translate-y-0.5">
                Request documents <Mail className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="border-t bg-white py-9" style={{ borderColor: V4.line }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-5 sm:px-6 md:flex-row">
          <div className="flex items-center gap-3">
            <BrandMark decorative className="h-8 w-8" />
            <div className="leading-tight">
              <p className="font-semibold text-[#014D4A]" style={{ fontFamily: DISPLAY_FONT }}>{association?.name || "YourCondoManager"}</p>
              <p className="mt-1 text-xs text-[#5b7572]">{association ? `${association.city}, ${association.state} · Self-managed · Powered by YourCondoManager` : "Community management, handled in one place."}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-semibold text-[#5b7572]">
            <a href="mailto:support@yourcondomanager.org" className="hover:text-[#014D4A]">Contact</a>
            <a href="/privacy" className="hover:text-[#014D4A]">Privacy</a>
            <a href="/terms" className="hover:text-[#014D4A]">Terms</a>
            <span>© {new Date().getFullYear()} YourCondoManager</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PortalPreviewItem({ icon: Icon, label }: { icon: typeof Info; label: string }) {
  return (
    <div className="rounded-xl bg-[#e9f6f4] p-4">
      <Icon className="h-5 w-5 text-[#014D4A]" aria-hidden="true" />
      <p className="mt-3 text-xs font-semibold text-[#33514d]">{label}</p>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-5 py-4 first:pt-0 last:pb-0">
      <dt className="text-sm text-[#5b7572]">{label}</dt>
      <dd className="text-right text-sm font-bold text-[#014D4A]">{value}</dd>
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

function ContactsSection({
  association,
  boardContacts,
  themeColor,
}: {
  association: PublicHubData["association"];
  boardContacts: PublicHubData["boardContacts"];
  themeColor: string;
}) {
  if (!association) return null;

  const inquiryHref = (subject: string) =>
    `mailto:support@yourcondomanager.org?subject=${encodeURIComponent(`${association.name}: ${subject}`)}`;

  return (
    <section className="space-y-7">
      <div>
        <SectionHeading icon={Users} title="Board contacts" themeColor={themeColor} />
        <div className="grid gap-3 sm:grid-cols-2">
          {boardContacts.map((contact) => (
            <Card key={contact.id} className={CARD_V4} style={cardBorder}>
              <CardContent className="p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: themeColor }}>
                  {contact.role}
                </p>
                <h3 className="mt-1 font-semibold" style={{ color: V4.ink }}>
                  {contact.firstName} {contact.lastName}
                </h3>
                <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed" style={{ color: V4.muted }}>
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{association.address}, {association.city}, {association.state}</span>
                </p>
                <a
                  href={inquiryHref(`message for ${contact.firstName} ${contact.lastName}, ${contact.role}`)}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-semibold hover:underline"
                  style={{ color: themeColor }}
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Contact through YCM
                </a>
              </CardContent>
            </Card>
          ))}
          {boardContacts.length === 0 && (
            <Card className={CARD_V4} style={cardBorder}>
              <CardContent className="p-5 text-sm" style={{ color: V4.muted }}>
                The public board directory is being confirmed. Messages can still be routed to the association through YCM.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div>
        <SectionHeading icon={Landmark} title="Lenders, insurers & closing professionals" themeColor={themeColor} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className={CARD_V4} style={cardBorder}>
            <CardContent className="p-5">
              <p className="font-semibold text-sm" style={{ color: V4.ink }}>Lender and closing inquiries</p>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: V4.muted }}>
                Request association documents, resale information, questionnaires, or closing coordination.
              </p>
              <a href={inquiryHref("lender or closing inquiry")} className={`${BTN_V4} mt-4`} style={{ backgroundColor: themeColor }}>
                <Mail className="h-4 w-4" aria-hidden="true" />
                Start an inquiry
              </a>
            </CardContent>
          </Card>
          <Card className={CARD_V4} style={cardBorder}>
            <CardContent className="p-5">
              <p className="font-semibold text-sm" style={{ color: V4.ink }}>Insurance inquiries</p>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: V4.muted }}>
                Ask about master-policy records, certificates of insurance, or association coverage contacts.
              </p>
              <a href={inquiryHref("insurance or certificate inquiry")} className={`${BTN_V4} mt-4`} style={{ backgroundColor: themeColor }}>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Contact the association
              </a>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className={CARD_V4} style={cardBorder}>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0" style={{ backgroundColor: `${themeColor}14`, color: themeColor }} aria-hidden="true">
              <Building2 className="h-[18px] w-[18px]" />
            </span>
            <div>
              <p className="font-medium text-sm" style={{ color: V4.ink }}>{association.name}</p>
              <p className="text-xs text-muted-foreground">{association.address}, {association.city}, {association.state}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
