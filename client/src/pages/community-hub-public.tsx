// zone: My Community
// persona: Owner
//
// Condensed, public-facing community page (v2). Redesign goals (William, v1 feedback):
//   - Short: ~1-2 screens, minimal scroll.
//   - NO dues / payment / billing / administrative content inline — that's an Owner Portal
//     concern. The page surfaces exactly ONE prominent "Owner Portal" entry (the existing
//     email-OTP access path, reframed) and nothing portal/dues/admin inline.
//   - Clean, welcoming, FOR a community page: branded header, short hero, brief About,
//     short Notices, compact board/contact footer. Everything heavy was cut.
//
// Real data preserved from /api/hub/:id/public: association (name/city/state), community
// description, notices, board/management contact. Cut sections (quick-actions, info-blocks,
// buildings, events, documents, map, welcome-mode) are intentionally not rendered here.
import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { t } from "@/i18n/use-strings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Bell,
  Building2,
  MapPin,
  Mail,
  KeyRound,
  Loader2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const TEAL = "#014D4A"; // primary brand (Deep Teal)
const ACCENT = "#2DBDB0"; // brand accent

type PublicHubData = {
  config: {
    communityDescription: string | null;
    welcomeHeadline: string | null;
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
};

export default function CommunityHubPublicPage() {
  useDocumentTitle(t("communityHubPublic.title"));
  const [, params] = useRoute("/community/:identifier");
  const identifier = params?.identifier || "";

  const { data: hub, isLoading, error } = useQuery<PublicHubData>({
    queryKey: [`/api/hub/${identifier}/public`],
    enabled: !!identifier,
    queryFn: async () => {
      const res = await fetch(`/api/hub/${encodeURIComponent(identifier)}/public`);
      if (!res.ok) throw new Error("Hub not found");
      return res.json();
    },
  });

  // Buildings query retained ONLY to derive the residence count for the hero subline —
  // not rendered as a section.
  const { data: buildingsData } = useQuery<{ buildings: Array<{ unitCount: number }>; unlinkedUnitCount: number }>({
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
      <div
        role="status"
        aria-label={t("common.loading")}
        className="min-h-screen flex items-center justify-center bg-[#F6FAFA]"
      >
        <div className="animate-pulse text-muted-foreground motion-reduce:animate-none">
          {t("communityHubPublic.loading")}
        </div>
      </div>
    );
  }

  if (error || !hub) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="min-h-screen flex items-center justify-center bg-[#F6FAFA] p-4"
      >
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-xl font-semibold mb-2">{t("communityHubPublic.error.title")}</h1>
            <p className="text-muted-foreground">{t("communityHubPublic.error.body")}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { config, association, notices } = hub;
  const communityName = association?.name || "Community";
  const location = association ? `${association.city}, ${association.state}` : null;

  const residenceCount =
    (buildingsData?.buildings || []).reduce((sum, b) => sum + (b.unitCount || 0), 0) +
    (buildingsData?.unlinkedUnitCount || 0);

  // Hero subline: "New Haven, CT · 18 residences" — only the parts we actually have.
  const heroMeta = [
    location,
    residenceCount > 0 ? `${residenceCount} residence${residenceCount === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  // One warm line. Prefer the operator's welcome headline, then first sentence of the
  // description, else a default.
  const warmLine =
    config.welcomeHeadline?.trim() ||
    (config.communityDescription
      ? config.communityDescription.split(/(?<=[.!?])\s+/).slice(0, 1).join(" ")
      : "Welcome home. Everything your community needs, in one place.");

  // Brief About: up to 3 sentences from the description (kept short).
  const aboutSentences = config.communityDescription
    ? config.communityDescription.split(/(?<=[.!?])\s+/).slice(0, 3).join(" ")
    : null;

  // Short notices: at most 2, pinned first.
  const shortNotices = [...notices]
    .sort((a, b) => (b.isPinned || 0) - (a.isPinned || 0))
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-[#F6FAFA] text-slate-800">
      {/* Compact branded header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5" aria-label="Your Condo Manager">
            <img
              src="/brand/ycm-logo-canonical.png"
              alt=""
              aria-hidden="true"
              className="h-8 w-8 rounded-md"
            />
            <span
              className="font-semibold tracking-tight text-[15px]"
              style={{ color: TEAL, fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' }}
            >
              Your Condo Manager
            </span>
          </a>
        </div>
      </header>

      {/* Short hero */}
      <section
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${TEAL} 0%, #036A66 100%)` }}
      >
        {/* soft accent glow */}
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-16 h-64 w-64 rounded-full opacity-25 blur-3xl"
          style={{ background: ACCENT }}
        />
        <div className="relative max-w-3xl mx-auto px-5 py-12 sm:py-16">
          <h1
            className="text-3xl sm:text-4xl font-bold text-white leading-tight"
            style={{ fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' }}
          >
            {communityName}
          </h1>
          {heroMeta && (
            <p className="mt-2 text-white/85 text-sm font-medium flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              {heroMeta}
            </p>
          )}
          <p className="mt-4 text-white/90 max-w-xl text-base sm:text-lg leading-relaxed">
            {warmLine}
          </p>

          {/* The single prominent Owner Portal entry */}
          <OwnerPortalCta />
        </div>
      </section>

      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-3xl mx-auto px-5 py-10 space-y-8"
      >
        {/* Brief About */}
        {aboutSentences && (
          <section aria-labelledby="about-heading">
            <h2
              id="about-heading"
              className="text-sm font-semibold uppercase tracking-wide mb-2"
              style={{ color: TEAL }}
            >
              About the Community
            </h2>
            <p className="text-slate-600 leading-relaxed">{aboutSentences}</p>
          </section>
        )}

        {/* Short Notices */}
        {shortNotices.length > 0 && (
          <section aria-labelledby="notices-heading">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4" style={{ color: ACCENT }} aria-hidden="true" />
              <h2
                id="notices-heading"
                className="text-sm font-semibold uppercase tracking-wide"
                style={{ color: TEAL }}
              >
                Latest Notices
              </h2>
            </div>
            <div className="space-y-3">
              {shortNotices.map((notice) => (
                <Card
                  key={notice.id}
                  className="border-slate-200 shadow-sm"
                  style={notice.isPinned ? { borderLeft: `3px solid ${ACCENT}` } : undefined}
                >
                  <CardContent className="py-4">
                    <h3 className="font-semibold text-slate-800">{notice.title}</h3>
                    <p className="text-sm text-slate-600 mt-1 whitespace-pre-line line-clamp-3">
                      {notice.body}
                    </p>
                    {notice.publishedAt && (
                      <p className="text-xs text-slate-400 mt-2">
                        {new Date(notice.publishedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Compact contact / board footer */}
        {association && (
          <section aria-labelledby="contact-heading">
            <h2
              id="contact-heading"
              className="text-sm font-semibold uppercase tracking-wide mb-2"
              style={{ color: TEAL }}
            >
              Contact
            </h2>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="py-4 flex items-start gap-3">
                <Building2 className="h-5 w-5 mt-0.5 shrink-0" style={{ color: ACCENT }} aria-hidden="true" />
                <div>
                  <p className="font-medium text-slate-800">{association.name}</p>
                  {location && <p className="text-sm text-slate-500">{location}</p>}
                  <p className="text-sm text-slate-600 mt-2">
                    Questions for the board or management? Sign in to the Owner Portal to send a
                    message or open a request.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-3xl mx-auto px-5 flex items-center justify-center gap-2 text-sm text-slate-400">
          <BrandMark decorative className="h-5 w-5" />
          <span>Powered by Your Condo Manager</span>
        </div>
      </footer>
    </div>
  );
}

/**
 * Owner Portal entry — the single prominent call-to-action in the hero.
 * Reuses the existing email-OTP access path (the portal sign-in flow), reframed as
 * "Owner Portal". No dues / payment / portal content is shown inline on this page —
 * the button reveals only the lightweight email → code sign-in, then redirects to /portal.
 */
function OwnerPortalCta() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="mt-7">
        <Button
          size="lg"
          onClick={() => setOpen(true)}
          className="bg-white text-[#014D4A] hover:bg-white/90 font-semibold shadow-lg shadow-black/10 h-12 px-6 rounded-xl"
        >
          <KeyRound className="h-5 w-5 mr-2" aria-hidden="true" />
          Owner Portal
          <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
        </Button>
        <p className="mt-2 text-white/70 text-xs">
          Residents sign in to view documents, send requests, and more.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-7 max-w-sm">
      <Card className="bg-white border-0 shadow-xl">
        <CardContent className="pt-5 pb-4">
          <OwnerPortalSignIn onCancel={() => setOpen(false)} />
        </CardContent>
      </Card>
    </div>
  );
}

function OwnerPortalSignIn({ onCancel }: { onCancel: () => void }) {
  const [step, setStep] = useState<"email" | "pin" | "success">("email");
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

  if (step === "success") {
    return (
      <div className="text-center py-4">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2" style={{ color: TEAL }} aria-hidden="true" />
        <p className="text-sm font-medium text-slate-700">Verified! Opening your portal…</p>
      </div>
    );
  }

  if (step === "email") {
    return (
      <form onSubmit={handleRequestPin} className="space-y-3">
        <div className="text-center mb-1">
          <Mail className="h-6 w-6 mx-auto mb-1.5" style={{ color: TEAL }} aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-800">Owner Portal sign-in</p>
          <p className="text-xs text-slate-500">We'll email you a one-time code.</p>
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
        <Button
          type="submit"
          className="w-full text-white"
          style={{ backgroundColor: TEAL }}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Code"}
        </Button>
        <button
          type="button"
          className="w-full text-xs text-slate-400 hover:text-slate-600"
          onClick={onCancel}
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyPin} className="space-y-3">
      <div className="text-center mb-1">
        <KeyRound className="h-6 w-6 mx-auto mb-1.5" style={{ color: TEAL }} aria-hidden="true" />
        <p className="text-sm font-semibold text-slate-800">Enter your code</p>
        <p className="text-xs text-slate-500">
          Sent to <strong>{email}</strong>
        </p>
        {simulatedOtp && (
          <p className="text-xs text-amber-600 mt-1">
            Demo mode — code: <strong>{simulatedOtp}</strong>
          </p>
        )}
      </div>
      <Input
        type="text"
        inputMode="numeric"
        placeholder="6-digit code"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        maxLength={6}
        required
        autoFocus
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        type="submit"
        className="w-full text-white"
        style={{ backgroundColor: TEAL }}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Sign In"}
      </Button>
      <button
        type="button"
        className="w-full text-xs text-slate-400 hover:text-slate-600"
        onClick={() => {
          setStep("email");
          setPin("");
          setError("");
        }}
      >
        Use a different email
      </button>
    </form>
  );
}
