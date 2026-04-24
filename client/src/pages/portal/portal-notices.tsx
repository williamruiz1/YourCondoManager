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
import type { CommunicationHistory } from "@shared/schema";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortalShell, usePortalContext } from "./portal-shell";

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
      <Card>
        <CardContent className="py-8 text-center text-sm text-on-surface-variant">
          No notices right now. You're all caught up.
        </CardContent>
      </Card>
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
            className={`w-full rounded-xl border p-4 text-left transition-colors ${
              isRead ? "border-outline-variant/10 bg-surface" : "border-primary/30 bg-primary/5"
            }`}
            data-testid={`portal-notice-${notice.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {!isRead ? <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" /> : null}
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
        <Card>
          <CardContent className="py-6 text-sm text-on-surface-variant">
            No elections or ballots right now.
          </CardContent>
        </Card>
      ) : null}

      {active.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
            Active ballots
          </h3>
          {active.map((entry) => {
            const token = tokenByElectionId[entry.election.id];
            return (
              <Card key={entry.election.id}>
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
                      className="shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-primary hover:bg-primary/90"
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
            <Card key={entry.election.id}>
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
      <Card>
        <CardContent className="py-6 text-sm text-on-surface-variant" data-testid="portal-notices-messages-empty">
          No messages yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2" data-testid="portal-notices-messages">
      {messages.map((msg) => (
        <Card key={msg.id}>
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

  const { data: notices = [] } = useQuery<NoticeEntry[]>({
    queryKey: ["portal/notices", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/notices");
      if (!res.ok) return [];
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
    <div className="mx-auto flex max-w-4xl flex-col gap-6" data-testid="portal-notices">
      <div>
        <Link href="/portal/community" className="text-xs font-semibold text-primary hover:underline">
          ← Back to My Community
        </Link>
        <h1 className="mt-2 font-headline text-3xl md:text-4xl" data-testid="portal-notices-heading">
          Notices & votes
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Announcements from your manager, open ballots, and messages sent to you.
        </p>
      </div>
      <Tabs defaultValue="notices">
        <TabsList>
          <TabsTrigger value="notices">
            Notices {unreadCount > 0 ? `(${unreadCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="ballots">
            Ballots {activeBallotCount > 0 ? `(${activeBallotCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>
        <TabsContent value="notices" className="mt-4">
          <NoticesSection notices={notices} readIds={readIds} markAsRead={markAsRead} />
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
