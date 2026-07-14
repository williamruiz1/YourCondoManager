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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Bell, ExternalLink, Info, ChevronRight, Building2, Phone, MapPin, Calendar, FileText, Download, Mail, KeyRound, Loader2, CheckCircle2, Home } from "lucide-react";
import CommunityMapView from "@/components/community-map-view";

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

// --- v4 premium aesthetic tokens ---------------------------------------------
// Editorial serif for the hero h1 + section h2s (Source Serif 4 is loaded in
// client/index.html). Falls back to Georgia/serif if it hasn't loaded.
const SERIF = '"Source Serif 4", Georgia, serif';
// Refined palette (teal brand). themeColor still drives the live accent so a
// community can override it; these are the supporting tones.
const V4 = {
  ink: "#0f2725",
  muted: "#5b716e",
  line: "#e3ecea",
  pageBg: "#f5f9f8",
} as const;

// Shared section-heading pattern — a teal icon chip + a serif title. Defined
// once so every section renders identically.
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
      <h2 className="text-xl font-semibold tracking-tight" style={{ fontFamily: SERIF, color: V4.ink }}>
        {title}
      </h2>
    </div>
  );
}

// Shared card chrome — softer corners, generous padding, subtle teal-tinted
// border + gentle shadow. Applied via className so no card logic changes.
const CARD_V4 = "rounded-2xl border shadow-sm transition-shadow hover:shadow-md";
const cardBorder = { borderColor: V4.line } as const;

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
            <h1 className="text-xl font-semibold mb-2" style={{ fontFamily: SERIF, color: V4.ink }}>{t("communityHubPublic.error.title")}</h1>
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
                  <Badge variant="outline" className="text-xs shrink-0 rounded-full" style={{ borderColor: `${themeColor}33`, color: themeColor }}>{new Date(m.scheduledAt).toLocaleDateString()}</Badge>
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
                    <Button variant="ghost" size="sm" className="rounded-xl" style={{ color: themeColor }}><Download className="h-4 w-4" /></Button>
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
          style={{ background: "#2DBDB0" }}
        />
        <div className="relative max-w-4xl mx-auto px-4 py-12 sm:py-20">
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
                className="text-2xl sm:text-4xl font-bold text-white tracking-tight leading-tight"
                style={{ fontFamily: SERIF }}
              >
                {association?.name || "Community Hub"}
              </h1>
              {association && (
                <p className="text-white/85 text-sm sm:text-base mt-1 flex items-center gap-1.5">
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
        {/* base accent rule */}
        <div className="h-1 w-full" style={{ background: "#2DBDB0" }} aria-hidden="true" />
      </header>

      <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Welcome Mode */}
        {config.welcomeModeEnabled === 1 && config.welcomeHeadline && (
          <Card className={`${CARD_V4} border`} style={{ borderColor: `${themeColor}33`, background: `linear-gradient(180deg, ${themeColor}0a, transparent)` }}>
            <CardContent className="pt-6 pb-5 px-6">
              <h2 className="text-xl font-semibold mb-3 tracking-tight" style={{ fontFamily: SERIF, color: V4.ink }}>{config.welcomeHeadline}</h2>
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

        {/* Dynamic section rendering based on configurable order */}
        {sectionOrder
          .filter((section) => enabledSections.includes(section))
          .map((section) => {
            const renderer = sectionRenderers[section];
            if (!renderer) return null;
            const content = renderer();
            if (!content) return null;
            return <div key={section}>{content}</div>;
          })}

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

        {/* Authenticate CTA */}
        <Separator />
        <HubAuthSection themeColor={themeColor} />
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-7 mt-10" style={{ borderColor: V4.line }}>
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-center gap-2 text-sm" style={{ color: V4.muted }}>
          <BrandMark decorative className="h-6 w-6" />
          <p>Powered by YourCondoManager</p>
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

  const priorityColors: Record<string, string> = {
    urgent: "bg-red-100 text-red-800 border-red-200",
    important: "bg-amber-100 text-amber-800 border-amber-200",
    normal: "bg-gray-100 text-gray-800 border-gray-200",
  };

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
      <div className="space-y-3">
        {filteredNotices.map((notice) => (
          <Card
            key={notice.id}
            className={`${CARD_V4} ${notice.isPinned ? "border-l-[3px]" : ""}`}
            style={notice.isPinned ? { ...cardBorder, borderLeftColor: themeColor } : cardBorder}
          >
            <CardContent className="pt-5 pb-4 px-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  {notice.isPinned === 1 && (
                    <Badge variant="secondary" className="text-xs rounded-full" style={{ backgroundColor: `${themeColor}14`, color: themeColor }}>Pinned</Badge>
                  )}
                  <Badge className={`text-xs rounded-full ${priorityColors[notice.priority] || priorityColors.normal}`}>
                    {notice.priority}
                  </Badge>
                  {notice.noticeCategory && notice.noticeCategory !== "general" && (
                    <Badge variant="outline" className="text-xs capitalize rounded-full" style={{ borderColor: V4.line }}>{notice.noticeCategory}</Badge>
                  )}
                </div>
                <h3 className="font-semibold text-[15px]" style={{ color: V4.ink }}>{notice.title}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-line leading-relaxed">{notice.body}</p>
              </div>
              <div className="flex items-center gap-3 mt-3.5 pt-3 border-t text-xs text-muted-foreground" style={{ borderColor: V4.line }}>
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
      <h2 className="text-xl font-semibold mb-4 tracking-tight" style={{ fontFamily: SERIF, color: V4.ink }}>Quick Actions</h2>
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
        <Button className="rounded-xl shadow-sm hover:shadow-md transition-shadow" style={{ backgroundColor: themeColor }} onClick={() => setStep("email")}>
          <Mail className="h-4 w-4 mr-2" />
          Sign In with Email
        </Button>
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
              <Button type="submit" className="w-full rounded-xl" style={{ backgroundColor: themeColor }} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Code"}
              </Button>
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
              <Button type="submit" className="w-full rounded-xl" style={{ backgroundColor: themeColor }} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Sign In"}
              </Button>
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
