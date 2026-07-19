// zone: My Community
// persona: Owner
//
// 3.5 — PortalNotices (/portal/notices) replaces the `notices` + `voting` +
// `communications` tabs of the owner-portal.tsx mega-file. 1.1 Q5 locks
// only four first-person zones; Notices, Voting, and Communications all
// live under the My Community umbrella.
//
// - Notices: the association-wide updates feed from /api/portal/notices.
// - Votes/elections: the `elections` tab surfaces here as a "Ballots"
//   section (4.2 has no separate portal zone for voting).
// - Messages: /api/portal/communications inbox surfaces here as a
//   "Messages" section.

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Mail, Megaphone, Vote } from "lucide-react";
import type { CommunicationHistory } from "@shared/schema";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { PortalShell, usePortalContext } from "./portal-shell";
import "@/styles/portal-redesign.css";

type NoticeEntry = {
  id: string;
  subject: string;
  bodyText: string;
  bodySnippet?: string | null;
  createdAt: string;
};

type ElectionEntry = {
  election: {
    id: string;
    title: string;
    description: string | null;
    voteType: string;
    status: string;
    opensAt: string | null;
    closesAt: string | null;
  };
  participated: boolean;
  status: "voted" | "proxy-designated" | "not-voted";
  outcome: string | null;
};

type ActiveElectionToken = {
  election: { id: string; title: string; closesAt: string | null };
  token: string;
};

function NoticesSection({
  notices,
  readIds,
  markAsRead,
}: {
  notices: NoticeEntry[];
  readIds: string[];
  markAsRead: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (notices.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="No notices right now"
        description="You're all caught up. Announcements from your manager will show here."
        testId="portal-notices-empty"
      />
    );
  }

  return (
    <div className="space-y-2" data-testid="portal-notices-list">
      {notices.map((notice) => {
        const isRead = readIds.includes(notice.id);
        const isExpanded = expandedId === notice.id;
        return (
          <button
            type="button"
            key={notice.id}
            onClick={() => {
              setExpandedId(isExpanded ? null : notice.id);
              markAsRead(notice.id);
            }}
            className="w-full p-4 text-left transition-colors"
            style={{
              borderRadius: "var(--ds-radius, 12px)",
              border: isRead ? "1px solid var(--ds-gray, #e5e7eb)" : "1px solid var(--ds-accent, #15a39c)",
              background: isRead ? "#fff" : "var(--ds-infosoft, #bfe8e4)",
              boxShadow: "var(--ds-shadow, 0 1px 3px rgba(1,77,74,.04))",
            }}
            data-testid={`portal-notice-${notice.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {!isRead ? <span className="h-2 w-2 rounded-full" style={{ background: "var(--ds-teal, #014d4a)" }} aria-hidden="true" /> : null}
                  <p className="truncate text-sm font-semibold">{notice.subject}</p>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {new Date(notice.createdAt).toLocaleDateString()}
                </p>
                {isExpanded ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-on-surface">
                    {notice.bodyText?.trim() || notice.bodySnippet?.trim() || "No message body available."}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-on-surface-variant line-clamp-2">
                    {notice.bodySnippet || notice.bodyText}
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ElectionsSection({
  electionHistory,
  activeElections,
}: {
  electionHistory: ElectionEntry[];
  activeElections: ActiveElectionToken[];
}) {
  const tokenByElectionId = useMemo(() => {
    const map: Record<string, string> = {};
    activeElections.forEach((ae) => {
      map[ae.election.id] = ae.token;
    });
    return map;
  }, [activeElections]);

  const active = electionHistory.filter((e) => e.election.status === "open" && e.status === "not-voted");
  const history = electionHistory.filter((e) => e.participated || e.election.status === "closed" || e.election.status === "ended");

  return (
    <div className="space-y-4" data-testid="portal-notices-elections">
      {active.length === 0 && history.length === 0 ? (
        <EmptyState
          icon={Vote}
          title="No elections or ballots"
          description="Active ballots and voting history will show here."
          testId="portal-notices-ballots-empty"
        />
      ) : null}

      {active.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
            Active ballots
          </h3>
          {active.map((entry) => {
            const token = tokenByElectionId[entry.election.id];
            return (
              <Card key={entry.election.id} style={{ borderRadius: "var(--ds-radius, 12px)", boxShadow: "var(--ds-shadow, 0 1px 3px rgba(1,77,74,.04))" }}>
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{entry.election.title}</p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      {entry.election.closesAt
                        ? `Closes ${new Date(entry.election.closesAt).toLocaleDateString()}`
                        : "Open for voting"}
                    </p>
                  </div>
                  {token ? (
                    <a
                      href={`/vote/${token}`}
                      className="shrink-0 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider text-white"
                      style={{ background: "var(--ds-teal, #014d4a)" }}
                    >
                      Vote now
                    </a>
                  ) : (
                    <Badge variant="outline">Awaiting ballot</Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">History</h3>
          {history.slice(0, 10).map((entry) => (
            <Card key={entry.election.id} style={{ borderRadius: "var(--ds-radius, 12px)", boxShadow: "var(--ds-shadow, 0 1px 3px rgba(1,77,74,.04))" }}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{entry.election.title}</p>
                  <p className="mt-0.5 text-xs text-on-surface-variant capitalize">
                    {entry.election.status.replace(/-/g, " ")} ·{" "}
                    {entry.status === "voted" ? "You voted" : entry.status === "proxy-designated" ? "Proxy designated" : "Did not vote"}
                  </p>
                </div>
                {entry.outcome ? (
                  <Badge variant="secondary" className="capitalize">
                    {entry.outcome}
                  </Badge>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MessagesSection({ messages }: { messages: CommunicationHistory[] }) {
  if (messages.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No messages yet"
        description="Direct messages from your manager will appear here."
        testId="portal-notices-messages-empty"
      />
    );
  }

  return (
    <div className="space-y-2" data-testid="portal-notices-messages">
      {messages.map((msg) => (
        <Card key={msg.id} style={{ borderRadius: "var(--ds-radius, 12px)", boxShadow: "var(--ds-shadow, 0 1px 3px rgba(1,77,74,.04))" }}>
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{msg.subject ?? "(no subject)"}</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {(msg.channel ?? "message").toUpperCase()} ·{" "}
                  {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : "—"}
                </p>
              </div>
              <Badge variant="outline" className="capitalize">
                {msg.deliveryStatus ?? "sent"}
              </Badge>
            </div>
            {msg.bodySnippet ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-on-surface-variant line-clamp-4">
                {msg.bodySnippet}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function NoticesContent() {
  const { portalAccessId, portalFetch, session } = usePortalContext();

  const {
    data: notices = [],
    error: noticesError,
    refetch: refetchNotices,
  } = useQuery<NoticeEntry[]>({
    queryKey: ["portal/notices", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/notices");
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: electionHistory = [] } = useQuery<ElectionEntry[]>({
    queryKey: ["portal/elections", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/elections");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: activeElections = [] } = useQuery<ActiveElectionToken[]>({
    queryKey: ["portal/elections/active", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/elections/active");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: messages = [] } = useQuery<CommunicationHistory[]>({
    queryKey: ["portal/communications", portalAccessId],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/communications");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const readStorageKey = `portal-read-notices-${portalAccessId}`;
  const [readIds, setReadIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(readStorageKey);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(readStorageKey, JSON.stringify(readIds));
  }, [readIds, readStorageKey]);

  const markAsRead = (id: string) => {
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const unreadCount = notices.filter((n) => !readIds.includes(n.id)).length;
  const activeBallotCount = electionHistory.filter(
    (e) => e.election.status === "open" && e.status === "not-voted",
  ).length;

  return (
    <div className="pfx-scope mx-auto flex max-w-4xl flex-col gap-6" data-testid="portal-notices">
      <div className="pfx-pagehead">
        <Link href="/portal/community" className="text-xs font-semibold" style={{ color: "var(--ds-teal-700, #0a6a63)" }}>
          ← Back to My Community
        </Link>
        <p className="pfx-eyebrow mt-3">My Community</p>
        <h1 data-testid="portal-notices-heading">
          Notices &amp; votes
        </h1>
        <p className="pfx-lede">
          Announcements from your manager, open ballots, and messages sent to you.
        </p>
      </div>
      <Tabs defaultValue="notices">
        <TabsList className="pfx-tabstrip">
          <TabsTrigger className="pfx-tab" value="notices">
            Notices {unreadCount > 0 ? <span className="pfx-tab-count">{unreadCount}</span> : ""}
          </TabsTrigger>
          <TabsTrigger className="pfx-tab" value="ballots">
            Ballots {activeBallotCount > 0 ? <span className="pfx-tab-count">{activeBallotCount}</span> : ""}
          </TabsTrigger>
          <TabsTrigger className="pfx-tab" value="messages">Messages</TabsTrigger>
        </TabsList>
        <TabsContent value="notices" className="mt-4">
          {noticesError ? (
            <ErrorState
              title="Couldn't load notices"
              description="We hit an error loading association notices. Try again or refresh the page."
              retry={() => refetchNotices()}
              details={noticesError instanceof Error ? noticesError.message : undefined}
              testId="portal-notices-error"
            />
          ) : (
            <NoticesSection notices={notices} readIds={readIds} markAsRead={markAsRead} />
          )}
        </TabsContent>
        <TabsContent value="ballots" className="mt-4">
          <ElectionsSection electionHistory={electionHistory} activeElections={activeElections} />
        </TabsContent>
        <TabsContent value="messages" className="mt-4">
          <MessagesSection messages={messages} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function PortalNoticesPage() {
  useDocumentTitle("Notices");
  return (
    <PortalShell>
      <NoticesContent />
    </PortalShell>
  );
}

export { NoticesContent };
