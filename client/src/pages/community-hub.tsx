// zone: Communications
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Trash2, ExternalLink, Globe, Settings, FileText, MapPin, Link2,
  Bell, GripVertical, ChevronUp, ChevronDown, Eye, EyeOff, Calendar, Pin, Building2, Home
} from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type HubConfig = {
  id: string;
  associationId: string;
  isEnabled: number;
  logoUrl: string | null;
  bannerImageUrl: string | null;
  communityDescription: string | null;
  sectionOrder: string[];
  enabledSections: string[];
  themeColor: string | null;
  slug: string | null;
  welcomeModeEnabled: number;
  welcomeHeadline: string | null;
  welcomeHighlights: any;
  createdAt: string;
  updatedAt: string;
};

type ActionLink = {
  id: string;
  associationId: string;
  label: string;
  iconKey: string | null;
  routeType: "internal" | "external";
  routeTarget: string;
  orderIndex: number;
  isEnabled: number;
  autoDerived: number;
};

type InfoBlock = {
  id: string;
  associationId: string;
  category: string;
  title: string;
  body: string | null;
  externalLinks: any[];
  orderIndex: number;
  isEnabled: number;
};

type Notice = {
  id: string;
  associationId: string;
  title: string;
  body: string;
  priority: string;
  isPinned: number;
  isPublished: number;
  targetAudience: string;
  authorName: string | null;
  createdBy: string | null;
  noticeCategory: string | null;
  visibilityLevel: string | null;
  isDraft: number;
  scheduledPublishAt: string | null;
  expiresAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const SECTION_LABELS: Record<string, string> = {
  notices: "Notices & Bulletins",
  "quick-actions": "Quick Actions",
  "info-blocks": "Community Info",
  buildings: "Buildings & Units",
  map: "Infrastructure Map",
  contacts: "Contacts & Key Info",
};

const ALL_SECTIONS = ["notices", "quick-actions", "info-blocks", "buildings", "map", "contacts"];

export default function CommunityHubPage() {
  useDocumentTitle("Community Hub");
  const { toast } = useToast();
  const { activeAssociation } = useActiveAssociation();
  const associationId = activeAssociation?.id;

  const [activeTab, setActiveTab] = useState("config");
  const [newLinkOpen, setNewLinkOpen] = useState(false);
  const [newBlockOpen, setNewBlockOpen] = useState(false);

  // Form state for new action link
  const [linkLabel, setLinkLabel] = useState("");
  const [linkTarget, setLinkTarget] = useState("");
  const [linkRouteType, setLinkRouteType] = useState<"internal" | "external">("internal");

  // Form state for new info block
  const [blockTitle, setBlockTitle] = useState("");
  const [blockBody, setBlockBody] = useState("");
  const [blockCategory, setBlockCategory] = useState("custom");

  // Queries
  const { data: config, isLoading: configLoading } = useQuery<HubConfig | null>({
    queryKey: [`/api/associations/${associationId}/hub/config`],
    enabled: !!associationId,
  });

  const { data: actionLinks = [] } = useQuery<ActionLink[]>({
    queryKey: [`/api/associations/${associationId}/hub/action-links`],
    enabled: !!associationId,
  });

  const { data: infoBlocks = [] } = useQuery<InfoBlock[]>({
    queryKey: [`/api/associations/${associationId}/hub/info-blocks`],
    enabled: !!associationId,
  });

  const { data: notices = [] } = useQuery<Notice[]>({
    queryKey: [`/api/associations/${associationId}/hub/notices`],
    enabled: !!associationId,
  });

  // Mutations
  const saveConfigMutation = useMutation({
    mutationFn: async (updates: Partial<HubConfig>) => {
      const res = await apiRequest("PUT", `/api/associations/${associationId}/hub/config`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/associations/${associationId}/hub/config`] });
      toast({ title: "Hub configuration saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createLinkMutation = useMutation({
    mutationFn: async (data: { label: string; routeTarget: string; routeType: string }) => {
      const res = await apiRequest("POST", `/api/associations/${associationId}/hub/action-links`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/associations/${associationId}/hub/action-links`] });
      toast({ title: "Action link created" });
      setNewLinkOpen(false);
      setLinkLabel("");
      setLinkTarget("");
      setLinkRouteType("internal");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      await apiRequest("DELETE", `/api/associations/${associationId}/hub/action-links/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/associations/${associationId}/hub/action-links`] });
      toast({ title: "Action link removed" });
    },
  });

  const createBlockMutation = useMutation({
    mutationFn: async (data: { title: string; body: string; category: string }) => {
      const res = await apiRequest("POST", `/api/associations/${associationId}/hub/info-blocks`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/associations/${associationId}/hub/info-blocks`] });
      toast({ title: "Info block created" });
      setNewBlockOpen(false);
      setBlockTitle("");
      setBlockBody("");
      setBlockCategory("custom");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      await apiRequest("DELETE", `/api/associations/${associationId}/hub/info-blocks/${blockId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/associations/${associationId}/hub/info-blocks`] });
      toast({ title: "Info block removed" });
    },
  });

  if (!associationId) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <WorkspacePageHeader
          title="Community Hub"
          summary="Select an association to configure its community hub."
          eyebrow="Hub"
          breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Community Hub" }]}
        />
      </div>
    );
  }

  // Setup wizard for first-time configuration
  const autoPopulateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/associations/${associationId}/hub/auto-populate`, {});
      return res.json();
    },
    onSuccess: (data: { actions: string[] }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/associations/${associationId}/hub/config`] });
      queryClient.invalidateQueries({ queryKey: [`/api/associations/${associationId}/hub/action-links`] });
      queryClient.invalidateQueries({ queryKey: [`/api/associations/${associationId}/hub/info-blocks`] });
      queryClient.invalidateQueries({ queryKey: [`/api/associations/${associationId}/hub/notices`] });
      toast({ title: "Hub initialized", description: data.actions.join(". ") });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const isFirstSetup = !configLoading && !config;

  if (isFirstSetup) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <WorkspacePageHeader
          title="Community Hub"
          summary="Set up the public-facing community hub for this association."
          eyebrow={activeAssociation?.name || "Hub"}
          breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Community Hub" }]}
        />
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Get Started with Community Hub</CardTitle>
            <CardDescription>
              The Community Hub is a public-facing microsite for your association. Residents and prospective buyers
              can view notices, community info, quick links to the portal, and more.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>The setup wizard will:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Create your hub configuration with a URL slug</li>
                <li>Add default quick action links (Portal, Maintenance, Payments, Documents)</li>
                <li>Generate community info blocks from your association data</li>
                <li>Create a welcome notice</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => autoPopulateMutation.mutate()}
                disabled={autoPopulateMutation.isPending}
              >
                {autoPopulateMutation.isPending ? "Setting up..." : "Initialize Hub"}
              </Button>
              <Button
                variant="outline"
                onClick={() => saveConfigMutation.mutate({ isEnabled: 0 })}
              >
                Start from Scratch
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isEnabled = config?.isEnabled === 1;
  const hubUrl = config?.slug
    ? `/community/${config.slug}`
    : `/community/${associationId}`;

  const currentSectionOrder = (config?.sectionOrder as string[] | undefined) || ALL_SECTIONS;
  const currentEnabledSections = (config?.enabledSections as string[] | undefined) || ALL_SECTIONS.filter(s => s !== "map");

  function moveSectionUp(section: string) {
    const order = [...currentSectionOrder];
    const idx = order.indexOf(section);
    if (idx <= 0) return;
    [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
    saveConfigMutation.mutate({ sectionOrder: order });
  }

  function moveSectionDown(section: string) {
    const order = [...currentSectionOrder];
    const idx = order.indexOf(section);
    if (idx < 0 || idx >= order.length - 1) return;
    [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
    saveConfigMutation.mutate({ sectionOrder: order });
  }

  function toggleSection(section: string) {
    const enabled = [...currentEnabledSections];
    const idx = enabled.indexOf(section);
    if (idx >= 0) {
      enabled.splice(idx, 1);
    } else {
      enabled.push(section);
    }
    saveConfigMutation.mutate({ enabledSections: enabled });
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <WorkspacePageHeader
        title="Community Hub"
        summary="Configure the public-facing community hub for this association."
        eyebrow={activeAssociation?.name || "Hub"}
        breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Community Hub" }]}
        actions={
          <div className="flex items-center gap-3">
            {isEnabled && (
              <a href={hubUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Hub
                </Button>
              </a>
            )}
            <Badge variant={isEnabled ? "default" : "secondary"}>
              {isEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="config"><Settings className="h-4 w-4 mr-1.5" />Settings</TabsTrigger>
          <TabsTrigger value="sections"><Eye className="h-4 w-4 mr-1.5" />Sections</TabsTrigger>
          <TabsTrigger value="notices"><Bell className="h-4 w-4 mr-1.5" />Notices</TabsTrigger>
          <TabsTrigger value="actions"><Link2 className="h-4 w-4 mr-1.5" />Quick Actions</TabsTrigger>
          <TabsTrigger value="info"><FileText className="h-4 w-4 mr-1.5" />Info Blocks</TabsTrigger>
          <TabsTrigger value="buildings"><Building2 className="h-4 w-4 mr-1.5" />Buildings</TabsTrigger>
          <TabsTrigger value="map"><MapPin className="h-4 w-4 mr-1.5" />Map</TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Hub Settings</CardTitle>
              <CardDescription>Enable the hub and configure branding for this association.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Community Hub</Label>
                  <p className="text-sm text-muted-foreground">Make this association's hub accessible to the public.</p>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => {
                    saveConfigMutation.mutate({ isEnabled: checked ? 1 : 0 });
                  }}
                />
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>URL Slug</Label>
                  <Input
                    placeholder="cherry-hill-court"
                    defaultValue={config?.slug || ""}
                    onBlur={(e) => {
                      if (e.target.value !== (config?.slug || "")) {
                        saveConfigMutation.mutate({ slug: e.target.value || null });
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Friendly URL: /community/your-slug</p>
                </div>
                <div className="space-y-2">
                  <Label>Theme Color</Label>
                  <Input
                    type="color"
                    defaultValue={config?.themeColor || "#3b82f6"}
                    onBlur={(e) => {
                      saveConfigMutation.mutate({ themeColor: e.target.value });
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Community Description</Label>
                <Textarea
                  placeholder="Welcome to our community..."
                  defaultValue={config?.communityDescription || ""}
                  rows={3}
                  onBlur={(e) => {
                    if (e.target.value !== (config?.communityDescription || "")) {
                      saveConfigMutation.mutate({ communityDescription: e.target.value || null });
                    }
                  }}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <Input
                    placeholder="https://example.com/logo.png"
                    defaultValue={config?.logoUrl || ""}
                    onBlur={(e) => {
                      if (e.target.value !== (config?.logoUrl || "")) {
                        saveConfigMutation.mutate({ logoUrl: e.target.value || null });
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Banner Image URL</Label>
                  <Input
                    placeholder="https://example.com/banner.jpg"
                    defaultValue={config?.bannerImageUrl || ""}
                    onBlur={(e) => {
                      if (e.target.value !== (config?.bannerImageUrl || "")) {
                        saveConfigMutation.mutate({ bannerImageUrl: e.target.value || null });
                      }
                    }}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Welcome Mode</Label>
                    <p className="text-sm text-muted-foreground">Show a welcome banner for new visitors and prospective buyers.</p>
                  </div>
                  <Switch
                    checked={config?.welcomeModeEnabled === 1}
                    onCheckedChange={(checked) => {
                      saveConfigMutation.mutate({ welcomeModeEnabled: checked ? 1 : 0 });
                    }}
                  />
                </div>
                {config?.welcomeModeEnabled === 1 && (
                  <div className="space-y-3 pl-4 border-l-2">
                    <div className="space-y-2">
                      <Label>Welcome Headline</Label>
                      <Input
                        placeholder="Welcome to Cherry Hill Court"
                        defaultValue={config?.welcomeHeadline || ""}
                        onBlur={(e) => {
                          if (e.target.value !== (config?.welcomeHeadline || "")) {
                            saveConfigMutation.mutate({ welcomeHeadline: e.target.value || null });
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sections Tab — ordering and visibility */}
        <TabsContent value="sections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Hub Section Layout</CardTitle>
              <CardDescription>Control which sections are visible and their display order on the public hub.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {currentSectionOrder.map((section, idx) => {
                  const isActive = currentEnabledSections.includes(section);
                  return (
                    <div
                      key={section}
                      className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                        isActive ? "bg-background" : "bg-muted/50 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">
                          {SECTION_LABELS[section] || section}
                        </span>
                        {!isActive && (
                          <Badge variant="secondary" className="text-xs">Hidden</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveSectionUp(section)}
                          disabled={idx === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveSectionDown(section)}
                          disabled={idx === currentSectionOrder.length - 1}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSection(section)}
                        >
                          {isActive ? (
                            <Eye className="h-4 w-4 text-green-600" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notices Tab */}
        <TabsContent value="notices" className="space-y-4">
          <NoticesManager associationId={associationId} notices={notices} />
        </TabsContent>

        {/* Quick Actions Tab */}
        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Action buttons displayed on the hub (max 8).</CardDescription>
              </div>
              <Dialog open={newLinkOpen} onOpenChange={setNewLinkOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={actionLinks.length >= 8}>
                    <Plus className="h-4 w-4 mr-1.5" />Add Action
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Quick Action</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Label</Label>
                      <Input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Pay HOA Fees" />
                    </div>
                    <div className="space-y-2">
                      <Label>Route Type</Label>
                      <Select value={linkRouteType} onValueChange={(v) => setLinkRouteType(v as "internal" | "external")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="internal">Internal Link</SelectItem>
                          <SelectItem value="external">External URL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{linkRouteType === "internal" ? "Path" : "URL"}</Label>
                      <Input
                        value={linkTarget}
                        onChange={(e) => setLinkTarget(e.target.value)}
                        placeholder={linkRouteType === "internal" ? "/portal" : "https://..."}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => createLinkMutation.mutate({ label: linkLabel, routeTarget: linkTarget, routeType: linkRouteType })}
                      disabled={!linkLabel || !linkTarget}
                    >
                      Create Action Link
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {actionLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No quick actions configured yet.</p>
              ) : (
                <div className="space-y-2">
                  {actionLinks.map((link) => (
                    <div key={link.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <span className="font-medium">{link.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {link.routeType === "external" ? <Globe className="h-3 w-3 inline" /> : null}
                          {link.routeTarget}
                        </span>
                        {link.autoDerived === 1 && <Badge variant="secondary" className="ml-2 text-xs">Auto</Badge>}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteLinkMutation.mutate(link.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Info Blocks Tab */}
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Information Blocks</CardTitle>
                <CardDescription>Community information cards displayed on the hub.</CardDescription>
              </div>
              <Dialog open={newBlockOpen} onOpenChange={setNewBlockOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Add Block</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Info Block</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={blockCategory} onValueChange={setBlockCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trash">Trash & Recycling</SelectItem>
                          <SelectItem value="parking">Parking</SelectItem>
                          <SelectItem value="emergency">Emergency Info</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="rules">Rules & Policies</SelectItem>
                          <SelectItem value="amenities">Amenities</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input value={blockTitle} onChange={(e) => setBlockTitle(e.target.value)} placeholder="Trash Pickup Schedule" />
                    </div>
                    <div className="space-y-2">
                      <Label>Content</Label>
                      <Textarea value={blockBody} onChange={(e) => setBlockBody(e.target.value)} rows={4} placeholder="Trash is collected every Tuesday..." />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => createBlockMutation.mutate({ title: blockTitle, body: blockBody, category: blockCategory })}
                      disabled={!blockTitle}
                    >
                      Create Info Block
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {infoBlocks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No info blocks configured yet.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {infoBlocks.map((block) => (
                    <Card key={block.id}>
                      <CardHeader className="pb-2 flex-row items-start justify-between">
                        <div>
                          <Badge variant="outline" className="mb-1 capitalize">{block.category}</Badge>
                          <CardTitle className="text-base">{block.title}</CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteBlockMutation.mutate(block.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </CardHeader>
                      {block.body && (
                        <CardContent className="pt-0">
                          <p className="text-sm text-muted-foreground line-clamp-3">{block.body}</p>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Buildings Tab */}
        <TabsContent value="buildings" className="space-y-4">
          <BuildingsTab associationId={associationId} />
        </TabsContent>

        {/* Map Tab */}
        <TabsContent value="map" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Community Infrastructure Map</CardTitle>
              <CardDescription>Configure the interactive map for this association. Upload a site plan and define areas.</CardDescription>
            </CardHeader>
            <CardContent>
              <MapLayerManager associationId={associationId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Buildings display tab — shows auto-populated building and unit data
function BuildingsTab({ associationId }: { associationId: string }) {
  const { data: buildingsData, isLoading } = useQuery<{ id: string; name: string; address: string; totalUnits: number | null; notes: string | null }[]>({
    queryKey: [`/api/buildings?associationId=${associationId}`],
    enabled: !!associationId,
  });
  const { data: unitsData } = useQuery<{ id: string; buildingId: string | null; unitNumber: string; building: string | null }[]>({
    queryKey: [`/api/units?associationId=${associationId}`],
    enabled: !!associationId,
  });

  const unitsByBuilding = (unitsData || []).reduce<Record<string, typeof unitsData>>((acc, unit) => {
    if (!unit) return acc;
    const key = unit.buildingId || "__none__";
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(unit);
    return acc;
  }, {});

  const buildings = buildingsData || [];
  const unlinked = unitsByBuilding["__none__"] || [];

  if (isLoading) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Loading buildings...</CardContent></Card>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Buildings & Units</CardTitle>
          <CardDescription>
            Auto-populated from your Building &amp; Unit Registry. To add or edit buildings, go to{" "}
            <a href="/app/buildings" className="underline">Building Management</a>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {buildings.length === 0 && unlinked.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">No buildings or units registered for this association yet.</p>
              <a href="/app/buildings">
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Buildings
                </Button>
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {buildings.map((b) => {
                const bUnits = unitsByBuilding[b.id] || [];
                return (
                  <div key={b.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <Home className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="font-medium">{b.name}</p>
                          <p className="text-sm text-muted-foreground">{b.address}</p>
                          {b.notes && <p className="text-xs text-muted-foreground mt-1">{b.notes}</p>}
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {bUnits.length} unit{bUnits.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    {bUnits.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {bUnits.map((u) => u && (
                          <Badge key={u.id} variant="outline" className="text-xs">{u.unitNumber}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {unlinked.length > 0 && (
                <div className="border rounded-lg p-4 border-dashed">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">Units not assigned to a building</p>
                    <Badge variant="secondary">{unlinked.length} unit{unlinked.length !== 1 ? "s" : ""}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {unlinked.map((u) => u && (
                      <Badge key={u.id} variant="outline" className="text-xs">{u.unitNumber}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// Notices management sub-component
function NoticesManager({ associationId, notices }: { associationId: string; notices: Notice[] }) {
  const { toast } = useToast();
  const [newNoticeOpen, setNewNoticeOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === notices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notices.map((n) => n.id)));
    }
  }

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [noticeCategory, setNoticeCategory] = useState("general");
  const [visibilityLevel, setVisibilityLevel] = useState("public");
  const [isDraft, setIsDraft] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [scheduledPublishAt, setScheduledPublishAt] = useState("");

  function resetForm() {
    setTitle("");
    setBody("");
    setPriority("normal");
    setNoticeCategory("general");
    setVisibilityLevel("public");
    setIsDraft(false);
    setIsPinned(false);
    setExpiresAt("");
    setScheduledPublishAt("");
  }

  function openEdit(notice: Notice) {
    setEditingNotice(notice);
    setTitle(notice.title);
    setBody(notice.body || "");
    setPriority(notice.priority || "normal");
    setNoticeCategory(notice.noticeCategory || "general");
    setVisibilityLevel(notice.visibilityLevel || "public");
    setIsDraft(notice.isDraft === 1);
    setIsPinned(notice.isPinned === 1);
    setExpiresAt(notice.expiresAt ? notice.expiresAt.slice(0, 16) : "");
    setScheduledPublishAt(notice.scheduledPublishAt ? notice.scheduledPublishAt.slice(0, 16) : "");
  }

  const createNoticeMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("POST", `/api/associations/${associationId}/hub/notices`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/associations/${associationId}/hub/notices`] });
      toast({ title: "Notice created" });
      setNewNoticeOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateNoticeMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, any>) => {
      const res = await apiRequest("PUT", `/api/associations/${associationId}/hub/notices/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/associations/${associationId}/hub/notices`] });
      toast({ title: "Notice updated" });
      setEditingNotice(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteNoticeMutation = useMutation({
    mutationFn: async (noticeId: string) => {
      await apiRequest("DELETE", `/api/associations/${associationId}/hub/notices/${noticeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/associations/${associationId}/hub/notices`] });
      toast({ title: "Notice deleted" });
    },
  });

  async function bulkAction(action: "publish" | "draft" | "delete") {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    for (const id of ids) {
      if (action === "delete") {
        await apiRequest("DELETE", `/api/associations/${associationId}/hub/notices/${id}`);
      } else {
        await apiRequest("PUT", `/api/associations/${associationId}/hub/notices/${id}`, {
          isDraft: action === "draft" ? 1 : 0,
          isPublished: action === "publish" ? 1 : 0,
          publishedAt: action === "publish" ? new Date().toISOString() : undefined,
        });
      }
    }
    queryClient.invalidateQueries({ queryKey: [`/api/associations/${associationId}/hub/notices`] });
    setSelectedIds(new Set());
    toast({ title: `${ids.length} notice(s) ${action === "delete" ? "deleted" : action === "publish" ? "published" : "moved to draft"}` });
  }

  function handleSave() {
    const data = {
      title,
      body,
      priority,
      noticeCategory,
      visibilityLevel,
      isDraft: isDraft ? 1 : 0,
      isPinned: isPinned ? 1 : 0,
      isPublished: isDraft ? 0 : 1,
      publishedAt: isDraft ? null : new Date().toISOString(),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      scheduledPublishAt: scheduledPublishAt ? new Date(scheduledPublishAt).toISOString() : null,
    };
    if (editingNotice) {
      updateNoticeMutation.mutate({ id: editingNotice.id, ...data });
    } else {
      createNoticeMutation.mutate(data);
    }
  }

  const priorityColors: Record<string, string> = {
    urgent: "bg-red-100 text-red-800",
    important: "bg-amber-100 text-amber-800",
    normal: "bg-gray-100 text-gray-800",
  };

  const visibilityLabels: Record<string, string> = {
    public: "Public",
    resident: "Residents",
    owner: "Owners",
    board: "Board",
    admin: "Admin Only",
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Notices & Bulletins</CardTitle>
            <CardDescription>Manage community notices displayed on the hub. Control visibility, scheduling, and priority.</CardDescription>
          </div>
          <Dialog open={newNoticeOpen || !!editingNotice} onOpenChange={(open) => {
            if (!open) { setNewNoticeOpen(false); setEditingNotice(null); resetForm(); }
            else setNewNoticeOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />New Notice</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingNotice ? "Edit Notice" : "Create Notice"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pool Closing for Maintenance" />
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="The community pool will be closed..." />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={noticeCategory} onValueChange={setNoticeCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="governance">Governance</SelectItem>
                        <SelectItem value="safety">Safety</SelectItem>
                        <SelectItem value="seasonal">Seasonal</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="financial">Financial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="important">Important</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Visibility</Label>
                    <Select value={visibilityLevel} onValueChange={setVisibilityLevel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public (anyone)</SelectItem>
                        <SelectItem value="resident">Residents only</SelectItem>
                        <SelectItem value="owner">Owners only</SelectItem>
                        <SelectItem value="board">Board only</SelectItem>
                        <SelectItem value="admin">Admin only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Expires At</Label>
                    <Input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Scheduled Publish</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledPublishAt}
                    onChange={(e) => setScheduledPublishAt(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Leave empty to publish immediately (unless saved as draft).</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch checked={isDraft} onCheckedChange={setIsDraft} />
                    <Label>Save as Draft</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={isPinned} onCheckedChange={setIsPinned} />
                    <Label>Pin to Top</Label>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleSave}
                  disabled={!title || !body}
                >
                  {editingNotice ? "Update Notice" : isDraft ? "Save Draft" : "Publish Notice"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-muted rounded-lg">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <Button size="sm" variant="outline" onClick={() => bulkAction("publish")}>Publish</Button>
              <Button size="sm" variant="outline" onClick={() => bulkAction("draft")}>Move to Draft</Button>
              <Button size="sm" variant="destructive" onClick={() => bulkAction("delete")}>Delete</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
            </div>
          )}
          {notices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No notices yet. Create one to keep your community informed.</p>
          ) : (
            <div className="space-y-2">
              {notices.length > 1 && (
                <div className="flex items-center gap-2 pb-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === notices.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-xs text-muted-foreground">Select all</span>
                </div>
              )}
              {notices.map((notice) => (
                <div
                  key={notice.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(notice.id)}
                    onChange={() => toggleSelected(notice.id)}
                    className="h-4 w-4 mt-0.5 rounded border-gray-300 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="min-w-0 flex-1" onClick={() => openEdit(notice)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{notice.title}</span>
                      {notice.isPinned === 1 && <Pin className="h-3 w-3 text-blue-500" />}
                      {notice.isDraft === 1 && <Badge variant="secondary" className="text-xs">Draft</Badge>}
                      {notice.isPublished === 1 && notice.isDraft !== 1 && <Badge variant="default" className="text-xs">Published</Badge>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[notice.priority] || priorityColors.normal}`}>
                        {notice.priority}
                      </span>
                      {notice.visibilityLevel && notice.visibilityLevel !== "public" && (
                        <Badge variant="outline" className="text-xs">{visibilityLabels[notice.visibilityLevel] || notice.visibilityLevel}</Badge>
                      )}
                      {notice.noticeCategory && (
                        <Badge variant="outline" className="text-xs capitalize">{notice.noticeCategory}</Badge>
                      )}
                    </div>
                    {notice.body && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">{notice.body}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {notice.publishedAt && (
                        <span>Published {new Date(notice.publishedAt).toLocaleDateString()}</span>
                      )}
                      {notice.expiresAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Expires {new Date(notice.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                      {notice.scheduledPublishAt && notice.isDraft === 1 && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Scheduled {new Date(notice.scheduledPublishAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={(e) => { e.stopPropagation(); deleteNoticeMutation.mutate(notice.id); }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// Map layer management sub-component
function MapLayerManager({ associationId }: { associationId: string }) {
  const { toast } = useToast();
  const [newLayerOpen, setNewLayerOpen] = useState(false);
  const [layerName, setLayerName] = useState("");
  const [layerImageUrl, setLayerImageUrl] = useState("");

  const { data: layers = [] } = useQuery<any[]>({
    queryKey: [`/api/associations/${associationId}/hub/map/layers`],
  });

  const { data: issues = [] } = useQuery<any[]>({
    queryKey: [`/api/associations/${associationId}/hub/map/issues`],
  });

  const createLayerMutation = useMutation({
    mutationFn: async (data: { name: string; baseImageUrl: string }) => {
      const res = await apiRequest("POST", `/api/associations/${associationId}/hub/map/layers`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/associations/${associationId}/hub/map/layers`] });
      toast({ title: "Map layer created" });
      setNewLayerOpen(false);
      setLayerName("");
      setLayerImageUrl("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateIssueMutation = useMutation({
    mutationFn: async ({ issueId, status }: { issueId: string; status: string }) => {
      const res = await apiRequest("PUT", `/api/associations/${associationId}/hub/map/issues/${issueId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/associations/${associationId}/hub/map/issues`] });
      toast({ title: "Issue status updated" });
    },
  });

  const statusColors: Record<string, string> = {
    "reported": "bg-yellow-100 text-yellow-800",
    "under-review": "bg-blue-100 text-blue-800",
    "approved": "bg-indigo-100 text-indigo-800",
    "in-progress": "bg-purple-100 text-purple-800",
    "resolved": "bg-green-100 text-green-800",
    "dismissed": "bg-gray-100 text-gray-800",
  };

  return (
    <div className="space-y-6">
      {/* Layers section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Map Layers</h3>
          <Dialog open={newLayerOpen} onOpenChange={setNewLayerOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1.5" />Add Layer</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Map Layer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Layer Name</Label>
                  <Input value={layerName} onChange={(e) => setLayerName(e.target.value)} placeholder="Main Site Plan" />
                </div>
                <div className="space-y-2">
                  <Label>Base Image URL</Label>
                  <Input value={layerImageUrl} onChange={(e) => setLayerImageUrl(e.target.value)} placeholder="https://example.com/site-plan.png" />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createLayerMutation.mutate({ name: layerName, baseImageUrl: layerImageUrl })}
                  disabled={!layerName || !layerImageUrl}
                >
                  Create Layer
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {layers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No map layers yet. Upload a site plan image to get started.</p>
        ) : (
          <div className="space-y-2">
            {layers.map((layer: any) => (
              <div key={layer.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-medium">{layer.name}</span>
                  <Badge variant={layer.isActive ? "default" : "secondary"} className="ml-2">
                    {layer.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Issues section */}
      <div>
        <h3 className="text-sm font-medium mb-3">Reported Issues ({issues.length})</h3>
        {issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">No issues reported yet.</p>
        ) : (
          <div className="space-y-2">
            {issues.map((issue: any) => (
              <div key={issue.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{issue.title}</span>
                    <Badge variant="outline" className="capitalize text-xs">{issue.category}</Badge>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[issue.status] || ""}`}>
                      {issue.status}
                    </span>
                  </div>
                  {issue.description && (
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{issue.description}</p>
                  )}
                </div>
                <Select
                  value={issue.status}
                  onValueChange={(status) => updateIssueMutation.mutate({ issueId: issue.id, status })}
                >
                  <SelectTrigger className="w-[140px] ml-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reported">Reported</SelectItem>
                    <SelectItem value="under-review">Under Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
