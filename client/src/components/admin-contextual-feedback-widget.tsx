import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { Flag, MapPin, Search } from "lucide-react";
import {
  ADMIN_CONTEXTUAL_FEEDBACK_INBOX_WORKSTREAM_TITLE,
  type AdminContextualFeedbackType,
} from "@shared/admin-contextual-feedback";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type AdminIdentity = {
  id: string;
  email: string;
};

type WidgetMode = "inactive" | "inspect" | "markers";
type FeedbackPriority = "low" | "medium" | "high" | "critical";

type ElementBounds = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

type ContextSnapshot = {
  route: string;
  selector: string;
  domPath: string;
  bounds: ElementBounds;
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  capturedAt: string;
  adminId: string;
  adminEmail: string;
  componentName: string | null;
  tagName: string;
  textPreview: string;
};

type FormState = {
  title: string;
  description: string;
  type: AdminContextualFeedbackType;
  priority: FeedbackPriority;
};

type StoredMarker = ContextSnapshot & {
  roadmapTaskId: string;
  roadmapTaskTitle: string;
  feedbackType: AdminContextualFeedbackType;
  priority: FeedbackPriority;
};

type RoadmapPayload = {
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: "todo" | "in-progress" | "done";
    priority: FeedbackPriority | null;
  }>;
};

type ActivatorPosition = {
  right: number;
  top: number;
};

const SCREENSHOT_TIMEOUT_MS = 3000;
const SCREENSHOT_PADDING = 32;
const SCREENSHOT_MAX_DIMENSION = 800;

const STORAGE_KEY = "admin-contextual-feedback:markers";
const ACTIVATOR_POSITION_STORAGE_KEY_PREFIX = "admin-contextual-feedback:activator-position";
const LONG_PRESS_MS = 450;
const FEEDBACK_PANEL_WIDTH = 360;
const FEEDBACK_PANEL_MARGIN = 16;
const FEEDBACK_PANEL_GAP = 12;
const FEEDBACK_PANEL_FALLBACK_HEIGHT = 440;

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  type: "bug",
  priority: "medium",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getElementBounds(element: HTMLElement): ElementBounds {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    right: rect.right,
    bottom: rect.bottom,
  };
}

function getElementAtPoint(x: number, y: number) {
  const element = document.elementFromPoint(x, y);
  if (!(element instanceof HTMLElement)) return null;
  return element;
}

function getInspectableElement(target: HTMLElement | null) {
  if (!target) return null;
  const ignored = target.closest("[data-admin-feedback-root='true']");
  if (ignored) return null;
  if (target === document.body || target === document.documentElement) return null;
  return target;
}

function buildSelector(element: HTMLElement) {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const segments: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== document.body && segments.length < 5) {
    const tag = current.tagName.toLowerCase();
    const classes = Array.from(current.classList)
      .filter((value) => !value.startsWith("data-"))
      .slice(0, 2)
      .map((value) => `.${CSS.escape(value)}`)
      .join("");
    const parent: HTMLElement | null = current.parentElement;
    const index = parent
      ? Array.from(parent.children)
          .filter((child) => child.tagName === current?.tagName)
          .indexOf(current) + 1
      : 1;
    segments.unshift(`${tag}${classes}:nth-of-type(${Math.max(index, 1)})`);
    current = parent;
  }

  return segments.join(" > ");
}

function buildDomPath(element: HTMLElement) {
  const segments: string[] = [];
  let current: HTMLElement | null = element;

  while (current) {
    const parent: HTMLElement | null = current.parentElement;
    const index = parent ? Array.from(parent.children).indexOf(current) + 1 : 1;
    segments.unshift(`${current.tagName.toLowerCase()}[${index}]`);
    if (current === document.body) break;
    current = parent;
  }

  return segments.join(" > ");
}

function getReactComponentName(element: HTMLElement) {
  const keys = Object.keys(element);
  const fiberKey = keys.find((key) => key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$"));
  if (!fiberKey) return null;

  let fiber: any = (element as unknown as Record<string, unknown>)[fiberKey];
  let depth = 0;
  while (fiber && depth < 20) {
    const componentType = fiber.type;
    if (typeof componentType === "function") {
      const name = componentType.displayName || componentType.name;
      if (name) return name;
    }
    if (typeof componentType === "object" && componentType && "displayName" in componentType) {
      const name = String((componentType as { displayName?: string }).displayName || "");
      if (name) return name;
    }
    fiber = fiber.return;
    depth += 1;
  }

  return null;
}

function getTextPreview(element: HTMLElement) {
  return (element.innerText || element.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

async function captureScreenshot(element: HTMLElement): Promise<string | null> {
  try {
    const rect = element.getBoundingClientRect();
    const x = Math.max(0, rect.left - SCREENSHOT_PADDING);
    const y = Math.max(0, rect.top - SCREENSHOT_PADDING);
    const w = Math.min(rect.width + SCREENSHOT_PADDING * 2, window.innerWidth - x, SCREENSHOT_MAX_DIMENSION);
    const h = Math.min(rect.height + SCREENSHOT_PADDING * 2, window.innerHeight - y, SCREENSHOT_MAX_DIMENSION);

    if (w < 10 || h < 10) return null;

    const svgData = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <foreignObject width="100%" height="100%" x="0" y="0">
          <div xmlns="http://www.w3.org/1999/xhtml"
               style="width:${w}px;height:${h}px;overflow:hidden;background:#fff;">
            <div style="margin-left:${-x}px;margin-top:${-y}px;">
              ${new XMLSerializer().serializeToString(document.documentElement)}
            </div>
          </div>
        </foreignObject>
      </svg>`;

    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    return await new Promise<string | null>((resolve) => {
      const img = new Image();
      const timeout = window.setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve(null);
      }, SCREENSHOT_TIMEOUT_MS);

      img.onload = () => {
        window.clearTimeout(timeout);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = Math.min(w, SCREENSHOT_MAX_DIMENSION);
          canvas.height = Math.min(h, SCREENSHOT_MAX_DIMENSION);
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/png", 0.85);
          resolve(dataUrl);
        } catch {
          resolve(null);
        } finally {
          URL.revokeObjectURL(url);
        }
      };

      img.onerror = () => {
        window.clearTimeout(timeout);
        URL.revokeObjectURL(url);
        resolve(null);
      };

      img.src = url;
    });
  } catch {
    return null;
  }
}

function captureSnapshot(element: HTMLElement, route: string, admin: AdminIdentity): ContextSnapshot {
  return {
    route,
    selector: buildSelector(element),
    domPath: buildDomPath(element),
    bounds: getElementBounds(element),
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    capturedAt: new Date().toISOString(),
    adminId: admin.id,
    adminEmail: admin.email,
    componentName: getReactComponentName(element),
    tagName: element.tagName.toLowerCase(),
    textPreview: getTextPreview(element),
  };
}

function describeBounds(bounds: ElementBounds) {
  return `top=${Math.round(bounds.top)}, left=${Math.round(bounds.left)}, width=${Math.round(bounds.width)}, height=${Math.round(bounds.height)}`;
}

function buildRoadmapDescription(snapshot: ContextSnapshot, form: FormState) {
  const lines = [
    "Contextual feedback captured from the live admin workspace.",
    "",
    `Type: ${form.type}`,
    `Priority: ${form.priority}`,
    `Route: ${snapshot.route}`,
    `Selector: ${snapshot.selector}`,
    `DOM path: ${snapshot.domPath}`,
    `Element tag: ${snapshot.tagName}`,
    `Element text preview: ${snapshot.textPreview || "(empty)"}`,
    `Bounds: ${describeBounds(snapshot.bounds)}`,
    `Scroll: x=${Math.round(snapshot.scrollX)}, y=${Math.round(snapshot.scrollY)}`,
    `Viewport: ${snapshot.viewportWidth}x${snapshot.viewportHeight}`,
    `Captured at: ${snapshot.capturedAt}`,
    `Admin: ${snapshot.adminEmail} (${snapshot.adminId})`,
    `React component: ${snapshot.componentName || "unavailable"}`,
    "",
    "Feedback summary:",
    form.description.trim(),
  ];

  return lines.join("\n");
}

function loadStoredMarkers() {
  if (typeof window === "undefined") return [] as StoredMarker[];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as StoredMarker[] : [];
  } catch {
    return [];
  }
}

function persistStoredMarkers(markers: StoredMarker[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(markers.slice(0, 50)));
  } catch {
    // Best-effort only in this slice.
  }
}

function getMarkerRect(marker: StoredMarker) {
  const element = document.querySelector(marker.selector);
  if (element instanceof HTMLElement) {
    return getElementBounds(element);
  }
  return marker.bounds;
}

type MarkerCluster = {
  markers: StoredMarker[];
  centroid: { top: number; left: number };
};

function clusterMarkers(markers: StoredMarker[], threshold = 40): MarkerCluster[] {
  if (markers.length === 0) return [];

  const rects = markers.map((m) => getMarkerRect(m));
  const assigned = new Set<number>();
  const clusters: MarkerCluster[] = [];

  for (let i = 0; i < markers.length; i++) {
    if (assigned.has(i)) continue;
    const group = [i];
    assigned.add(i);

    for (let j = i + 1; j < markers.length; j++) {
      if (assigned.has(j)) continue;
      const dx = rects[j].right - rects[i].right;
      const dy = rects[j].top - rects[i].top;
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
        group.push(j);
        assigned.add(j);
      }
    }

    const groupMarkers = group.map((idx) => markers[idx]);
    const groupRects = group.map((idx) => rects[idx]);
    const avgTop = groupRects.reduce((s, r) => s + r.top, 0) / groupRects.length;
    const avgLeft = groupRects.reduce((s, r) => s + r.right, 0) / groupRects.length;

    clusters.push({
      markers: groupMarkers,
      centroid: { top: avgTop - 10, left: avgLeft - 12 },
    });
  }

  return clusters;
}

function getModeLabel(mode: WidgetMode) {
  if (mode === "inspect") return "Feedback: Inspect";
  if (mode === "markers") return "Feedback: Markers";
  return "Feedback";
}

function extractFeedbackSummary(description: string | null) {
  if (!description) return "";
  const marker = "Feedback summary:\n";
  const index = description.indexOf(marker);
  if (index === -1) return description.trim();
  return description.slice(index + marker.length).trim();
}

function getActivatorPositionStorageKey(scope: "workspace" | "public") {
  return `${ACTIVATOR_POSITION_STORAGE_KEY_PREFIX}:${scope}`;
}

function getDefaultActivatorPosition(scope: "workspace" | "public"): ActivatorPosition {
  return scope === "workspace"
    ? { right: 96, top: 16 }
    : { right: 16, top: 88 };
}

function loadActivatorPosition(scope: "workspace" | "public"): ActivatorPosition {
  if (typeof window === "undefined") {
    return getDefaultActivatorPosition(scope);
  }

  try {
    const raw = window.localStorage.getItem(getActivatorPositionStorageKey(scope));
    if (!raw) return getDefaultActivatorPosition(scope);
    const parsed = JSON.parse(raw) as Partial<ActivatorPosition>;
    if (typeof parsed.right !== "number" || typeof parsed.top !== "number") {
      return getDefaultActivatorPosition(scope);
    }
    return { right: parsed.right, top: parsed.top };
  } catch {
    return getDefaultActivatorPosition(scope);
  }
}

function persistActivatorPosition(scope: "workspace" | "public", position: ActivatorPosition) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(getActivatorPositionStorageKey(scope), JSON.stringify(position));
  } catch {
    // Best-effort only.
  }
}

function clampActivatorPosition(position: ActivatorPosition) {
  if (typeof window === "undefined") return position;
  return {
    right: clamp(position.right, 8, Math.max(8, window.innerWidth - 120)),
    top: clamp(position.top, 8, Math.max(8, window.innerHeight - 48)),
  };
}

function getFeedbackPanelLayout(highlightRect: ElementBounds | null, panelHeight: number) {
  if (typeof window === "undefined") {
    return {
      top: 96,
      left: FEEDBACK_PANEL_MARGIN,
      width: FEEDBACK_PANEL_WIDTH,
      maxHeight: FEEDBACK_PANEL_FALLBACK_HEIGHT,
    };
  }

  const width = Math.min(FEEDBACK_PANEL_WIDTH, Math.max(280, window.innerWidth - (FEEDBACK_PANEL_MARGIN * 2)));
  const maxHeight = Math.max(240, window.innerHeight - (FEEDBACK_PANEL_MARGIN * 2));
  const visibleHeight = Math.min(Math.max(panelHeight, 240), maxHeight);

  if (!highlightRect) {
    return {
      top: 96,
      left: clamp(window.innerWidth - width - FEEDBACK_PANEL_MARGIN, FEEDBACK_PANEL_MARGIN, window.innerWidth - width - FEEDBACK_PANEL_MARGIN),
      width,
      maxHeight,
    };
  }

  const belowTop = highlightRect.bottom + FEEDBACK_PANEL_GAP;
  const aboveTop = highlightRect.top - visibleHeight - FEEDBACK_PANEL_GAP;
  const fitsBelow = belowTop + visibleHeight <= window.innerHeight - FEEDBACK_PANEL_MARGIN;
  const fitsAbove = aboveTop >= FEEDBACK_PANEL_MARGIN;

  const top = fitsBelow || (!fitsAbove && highlightRect.top < window.innerHeight / 2)
    ? clamp(belowTop, FEEDBACK_PANEL_MARGIN, window.innerHeight - visibleHeight - FEEDBACK_PANEL_MARGIN)
    : clamp(aboveTop, FEEDBACK_PANEL_MARGIN, window.innerHeight - visibleHeight - FEEDBACK_PANEL_MARGIN);

  const preferredLeft = highlightRect.left;
  const alternateLeft = highlightRect.right - width;
  const left = preferredLeft + width <= window.innerWidth - FEEDBACK_PANEL_MARGIN
    ? clamp(preferredLeft, FEEDBACK_PANEL_MARGIN, window.innerWidth - width - FEEDBACK_PANEL_MARGIN)
    : clamp(alternateLeft, FEEDBACK_PANEL_MARGIN, window.innerWidth - width - FEEDBACK_PANEL_MARGIN);

  return { top, left, width, maxHeight };
}

export function AdminContextualFeedbackWidget({ admin }: { admin: AdminIdentity }) {
  const [location, navigate] = useLocation();
  const positionScope = location === "/app" || location.startsWith("/app/") ? "workspace" : "public";
  const { toast } = useToast();
  const [mode, setMode] = useState<WidgetMode>("inactive");
  const [hoveredSnapshot, setHoveredSnapshot] = useState<ContextSnapshot | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<ContextSnapshot | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [markers, setMarkers] = useState<StoredMarker[]>(() => loadStoredMarkers());
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [activatorPosition, setActivatorPosition] = useState<ActivatorPosition>(() => loadActivatorPosition(positionScope));
  const [panelHeight, setPanelHeight] = useState(FEEDBACK_PANEL_FALLBACK_HEIGHT);
  const selectedElementRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const dragOffsetRef = useRef<{ right: number; top: number } | null>(null);
  const lastRouteRef = useRef(location);

  const roadmapQuery = useQuery<RoadmapPayload>({
    queryKey: ["/api/admin/roadmap"],
    enabled: mode === "markers" || markers.length > 0,
    refetchInterval: mode === "markers" ? 30000 : false,
  });
  const roadmapTasksById = useMemo(
    () => new Map((roadmapQuery.data?.tasks ?? []).map((task) => [task.id, task])),
    [roadmapQuery.data?.tasks],
  );

  const currentRouteMarkers = useMemo(
    () =>
      markers
        .filter((marker) => marker.route === location)
        .filter((marker) => roadmapTasksById.get(marker.roadmapTaskId)?.status !== "done"),
    [location, markers, roadmapTasksById],
  );

  const activeMarker = currentRouteMarkers.find((marker) => marker.roadmapTaskId === activeMarkerId) ?? null;

  useEffect(() => {
    persistStoredMarkers(markers);
  }, [markers]);

  useEffect(() => {
    persistActivatorPosition(positionScope, activatorPosition);
  }, [activatorPosition, positionScope]);

  useEffect(() => {
    setActivatorPosition(clampActivatorPosition(loadActivatorPosition(positionScope)));
  }, [positionScope]);

  useEffect(() => {
    const applyClamp = () => {
      setActivatorPosition((current) => {
        const next = clampActivatorPosition(current);
        if (next.right === current.right && next.top === current.top) {
          return current;
        }
        return next;
      });
    };

    applyClamp();
    window.addEventListener("resize", applyClamp);
    return () => window.removeEventListener("resize", applyClamp);
  }, []);

  useEffect(() => {
    if (lastRouteRef.current === location) return;
    lastRouteRef.current = location;

    if (mode === "inspect") {
      setMode("inactive");
      setHoveredSnapshot(null);
      setSelectedSnapshot(null);
      setForm(EMPTY_FORM);
      setEditingTaskId(null);
    }

    setActiveMarkerId(null);
  }, [location, mode]);

  useEffect(() => {
    if (!selectedSnapshot || typeof window === "undefined") return;
    const panelNode = panelRef.current;
    if (!panelNode) return;

    const updateHeight = () => {
      setPanelHeight(panelNode.getBoundingClientRect().height || FEEDBACK_PANEL_FALLBACK_HEIGHT);
    };

    updateHeight();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateHeight);
    observer?.observe(panelNode);
    window.addEventListener("resize", updateHeight);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [form.description, form.priority, form.title, form.type, selectedSnapshot, editingTaskId]);

  useEffect(() => {
    if (mode !== "inspect") return;

    const updateHover = (x: number, y: number) => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = window.requestAnimationFrame(() => {
        const element = getInspectableElement(getElementAtPoint(x, y));
        if (!element) {
          setHoveredSnapshot(null);
          return;
        }

        setHoveredSnapshot(captureSnapshot(element, location, admin));
      });
    };

    const selectElement = (element: HTMLElement | null) => {
      const inspectable = getInspectableElement(element);
      if (!inspectable) return;

      selectedElementRef.current = inspectable;
      const snapshot = captureSnapshot(inspectable, location, admin);
      setSelectedSnapshot(snapshot);
      setForm((current) => ({
        ...current,
        title: current.title || `${snapshot.tagName} on ${location}`,
      }));

      setIsCapturingScreenshot(true);
      setScreenshotBase64(null);
      captureScreenshot(inspectable).then((result) => {
        setScreenshotBase64(result);
        setIsCapturingScreenshot(false);
      });
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      updateHover(event.clientX, event.clientY);
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("[data-admin-feedback-root='true']")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      selectElement(getElementAtPoint(event.clientX, event.clientY) ?? target);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("[data-admin-feedback-root='true']")) return;
      if (event.pointerType !== "touch" && event.pointerType !== "pen") return;

      window.clearTimeout(longPressTimerRef.current ?? undefined);
      longPressTimerRef.current = window.setTimeout(() => {
        selectElement(getElementAtPoint(event.clientX, event.clientY) ?? target);
      }, LONG_PRESS_MS);
    };

    const clearLongPress = () => {
      window.clearTimeout(longPressTimerRef.current ?? undefined);
      longPressTimerRef.current = null;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMode("inactive");
        setHoveredSnapshot(null);
        setSelectedSnapshot(null);
        setForm(EMPTY_FORM);
        setEditingTaskId(null);
      }
    };

    const refreshSelection = () => {
      if (!selectedElementRef.current || !document.contains(selectedElementRef.current)) return;
      setSelectedSnapshot(captureSnapshot(selectedElementRef.current, location, admin));
    };

    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointerup", clearLongPress, true);
    document.addEventListener("pointercancel", clearLongPress, true);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("scroll", refreshSelection, true);
    window.addEventListener("resize", refreshSelection);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointerup", clearLongPress, true);
      document.removeEventListener("pointercancel", clearLongPress, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("scroll", refreshSelection, true);
      window.removeEventListener("resize", refreshSelection);
      clearLongPress();
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [admin, location, mode]);

  async function handleSubmit() {
    if (!selectedSnapshot) return;
    if (!form.title.trim() || !form.description.trim()) {
      toast({
        title: "Title and description required",
        description: "Capture what is wrong or what should change before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let taskTitle = "";
      let taskId = "";
      let targetWorkstreamTitle = ADMIN_CONTEXTUAL_FEEDBACK_INBOX_WORKSTREAM_TITLE;

      if (editingTaskId) {
        const routeLabel = selectedSnapshot.route.length > 48
          ? `${selectedSnapshot.route.slice(0, 45)}...`
          : selectedSnapshot.route;
        const prefix = form.type === "bug" ? "[Feedback Bug]" : "[Feedback Enhancement]";
        const response = await apiRequest("PATCH", `/api/admin/tasks/${editingTaskId}`, {
          title: `${prefix} ${routeLabel} - ${form.title.trim()}`.slice(0, 200),
          description: buildRoadmapDescription(selectedSnapshot, form),
          priority: form.priority,
        });
        const updatedTask = await response.json() as { id: string; title: string };
        taskId = updatedTask.id;
        taskTitle = updatedTask.title;
      } else {
        const response = await apiRequest("POST", "/api/admin/contextual-feedback", {
          title: form.title.trim(),
          description: form.description.trim(),
          feedbackType: form.type,
          priority: form.priority,
          screenshotBase64: screenshotBase64 || null,
          context: {
            route: selectedSnapshot.route,
            selector: selectedSnapshot.selector,
            domPath: selectedSnapshot.domPath,
            bounds: selectedSnapshot.bounds,
            scroll: {
              x: selectedSnapshot.scrollX,
              y: selectedSnapshot.scrollY,
            },
            viewport: {
              width: selectedSnapshot.viewportWidth,
              height: selectedSnapshot.viewportHeight,
            },
            timestamp: selectedSnapshot.capturedAt,
            componentName: selectedSnapshot.componentName,
            nodeName: selectedSnapshot.tagName,
            className: selectedElementRef.current?.className || "",
            elementLabel: form.title.trim(),
            textPreview: selectedSnapshot.textPreview,
          },
        });

        const createdTask = await response.json() as {
          task: { id: string; title: string };
          targetWorkstream: { title: string };
        };
        taskId = createdTask.task.id;
        taskTitle = createdTask.task.title;
        targetWorkstreamTitle = createdTask.targetWorkstream.title;
      }

      const marker: StoredMarker = {
        ...selectedSnapshot,
        roadmapTaskId: taskId,
        roadmapTaskTitle: taskTitle,
        feedbackType: form.type,
        priority: form.priority,
      };

      setMarkers((current) => [marker, ...current.filter((entry) => entry.roadmapTaskId !== marker.roadmapTaskId)]);
      setActiveMarkerId(marker.roadmapTaskId);
      setEditingTaskId(null);
      setMode("markers");
      setHoveredSnapshot(null);
      setSelectedSnapshot(null);
      setForm(EMPTY_FORM);
      setScreenshotBase64(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roadmap"] });

      toast({
        title: editingTaskId ? "Feedback ticket updated" : "Feedback ticket created",
        description: `${taskTitle} in ${targetWorkstreamTitle}`,
      });
    } catch (error) {
      toast({
        title: "Feedback submission failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function cycleMode() {
    setHoveredSnapshot(null);
    setSelectedSnapshot(null);
    setForm(EMPTY_FORM);
    setActiveMarkerId(null);
    setEditingTaskId(null);
    setScreenshotBase64(null);

    setMode((current) => {
      if (current === "inactive") return "inspect";
      if (current === "inspect") return "markers";
      return "inactive";
    });
  }

  function openRoadmap() {
    if (!activeMarker) return;
    navigate("/app/admin/roadmap");
  }

  function openMarkerForEdit() {
    if (!activeMarker) return;
    const task = roadmapTasksById.get(activeMarker.roadmapTaskId);
    setEditingTaskId(activeMarker.roadmapTaskId);
    setSelectedSnapshot(activeMarker);
    setForm({
      title: activeMarker.roadmapTaskTitle
        .replace(/^\[Feedback (Bug|Enhancement)\]\s+.+?\s+-\s+/, "")
        .replace(/^(Bug|Enhancement):\s+/, ""),
      description: extractFeedbackSummary(task?.description ?? null),
      type: activeMarker.feedbackType,
      priority: task?.priority ?? activeMarker.priority,
    });
    setMode("inspect");
  }

  function beginActivatorDrag(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) return;

    dragOffsetRef.current = {
      right: window.innerWidth - event.clientX - activatorPosition.right,
      top: event.clientY - activatorPosition.top,
    };

      const handleMove = (moveEvent: PointerEvent) => {
        const offset = dragOffsetRef.current;
        if (!offset) return;

      const nextRight = clamp(window.innerWidth - moveEvent.clientX - offset.right, 8, Math.max(8, window.innerWidth - 120));
      const nextTop = clamp(moveEvent.clientY - offset.top, 8, Math.max(8, window.innerHeight - 48));
      setActivatorPosition(clampActivatorPosition({ right: nextRight, top: nextTop }));
    };

    const stopDrag = () => {
      dragOffsetRef.current = null;
      window.removeEventListener("pointermove", handleMove, true);
      window.removeEventListener("pointerup", stopDrag, true);
      window.removeEventListener("pointercancel", stopDrag, true);
    };

    window.addEventListener("pointermove", handleMove, true);
    window.addEventListener("pointerup", stopDrag, true);
    window.addEventListener("pointercancel", stopDrag, true);
  }

  if (typeof document === "undefined") return null;

  const highlightSnapshot = selectedSnapshot ?? hoveredSnapshot;
  const highlightRect = highlightSnapshot?.bounds ?? null;
  const panelLayout = getFeedbackPanelLayout(highlightRect, panelHeight);

  return createPortal(
    <>
      <div
        data-admin-feedback-root="true"
        className="pointer-events-auto fixed z-[95] flex items-center gap-2 rounded-full border border-amber-300 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 px-2 py-1 text-slate-950 shadow-[0_10px_30px_rgba(249,115,22,0.35)] backdrop-blur"
        style={{
          right: activatorPosition.right,
          top: activatorPosition.top,
        }}
        onPointerDown={beginActivatorDrag}
      >
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 gap-2 rounded-full border border-white/60 bg-white/90 px-3 text-slate-950 hover:bg-white"
          onClick={cycleMode}
        >
          {mode === "inspect" ? <Search className="h-4 w-4" /> : mode === "markers" ? <MapPin className="h-4 w-4" /> : <Flag className="h-4 w-4" />}
          {getModeLabel(mode)}
        </Button>
        {mode === "markers" && currentRouteMarkers.length > 0 ? (
          <span className="rounded-full bg-white/85 px-2 py-1 text-xs font-semibold text-slate-900">
            {currentRouteMarkers.length} on this route
          </span>
        ) : null}
        <span className="select-none rounded-full bg-black/10 px-1.5 py-1 text-[11px] font-medium text-slate-950/80">
          ⠿
        </span>
      </div>

      {mode !== "inactive" ? (
        <div className="pointer-events-none fixed inset-0 z-[90]">
          {highlightRect ? (
            <>
              <div
                className="absolute rounded-md border-2 border-sky-500 bg-sky-500/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.08)]"
                style={{
                  top: highlightRect.top,
                  left: highlightRect.left,
                  width: highlightRect.width,
                  height: highlightRect.height,
                }}
              />
              {mode === "inspect" ? (
                <div
                  className="absolute rounded-md bg-slate-950 px-2 py-1 text-xs text-white shadow-lg"
                  style={{
                    top: clamp(highlightRect.top - 36, 12, window.innerHeight - 44),
                    left: clamp(highlightRect.left, 12, window.innerWidth - 240),
                    maxWidth: 240,
                  }}
                >
                  <div className="font-medium">{highlightSnapshot?.tagName}</div>
                  <div className="truncate text-slate-300">{highlightSnapshot?.selector}</div>
                </div>
              ) : null}
            </>
          ) : null}

          {mode === "inspect" ? (
            <div className="absolute left-4 top-20 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-lg backdrop-blur">
              Hover and click to capture. Long-press on touch. Press Escape to exit.
            </div>
          ) : null}

          {selectedSnapshot ? (
            <div
              ref={panelRef}
              data-admin-feedback-root="true"
              className="pointer-events-auto absolute overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
              style={{
                top: panelLayout.top,
                left: panelLayout.left,
                width: panelLayout.width,
                maxHeight: panelLayout.maxHeight,
              }}
            >
              <div className="mb-3">
                <div className="text-sm font-semibold text-slate-900">
                  {editingTaskId ? "Edit roadmap ticket" : "Create roadmap ticket"}
                </div>
                <div className="mt-1 text-xs text-slate-500">{selectedSnapshot.selector}</div>
              </div>
              <div className="space-y-3">
                <div className="grid gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Title</label>
                  <Input
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                        event.preventDefault();
                        void handleSubmit();
                      }
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-medium text-slate-700">Description</label>
                  <Textarea
                    value={form.description}
                    rows={5}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                        event.preventDefault();
                        void handleSubmit();
                      }
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-slate-700">Type</label>
                    <select
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                      value={form.type}
                      onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as AdminContextualFeedbackType }))}
                    >
                      <option value="bug">Bug</option>
                      <option value="enhancement">Enhancement</option>
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-slate-700">Priority</label>
                    <select
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                      value={form.priority}
                      onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as FeedbackPriority }))}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <div>Route: {selectedSnapshot.route}</div>
                  <div>Bounds: {describeBounds(selectedSnapshot.bounds)}</div>
                  <div>Component: {selectedSnapshot.componentName || "unavailable"}</div>
                </div>
                {isCapturingScreenshot ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500">
                    Capturing screenshot...
                  </div>
                ) : screenshotBase64 ? (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Screenshot</label>
                    <div className="relative overflow-hidden rounded-lg border border-slate-200">
                      <img
                        src={screenshotBase64}
                        alt="Screenshot of selected element"
                        className="max-h-40 w-full object-contain bg-slate-50"
                        loading="lazy"
                        decoding="async"
                      />
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-slate-900"
                        onClick={() => setScreenshotBase64(null)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedSnapshot(null);
                      setForm(EMPTY_FORM);
                      setScreenshotBase64(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : editingTaskId ? "Save changes" : "Create ticket"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {mode === "markers"
            ? clusterMarkers(currentRouteMarkers).map((cluster, clusterIdx) => {
              if (cluster.markers.length === 1) {
                const marker = cluster.markers[0];
                const rect = getMarkerRect(marker);
                return (
                  <button
                    key={marker.roadmapTaskId}
                    type="button"
                    data-admin-feedback-root="true"
                    className="pointer-events-auto absolute flex h-7 min-w-7 items-center justify-center rounded-full border border-amber-300 bg-amber-400 px-2 text-xs font-semibold text-slate-900 shadow-lg"
                    style={{
                      top: clamp(rect.top - 10, 12, window.innerHeight - 40),
                      left: clamp(rect.right - 12, 12, window.innerWidth - 56),
                    }}
                    onClick={() => setActiveMarkerId(marker.roadmapTaskId)}
                    title={marker.roadmapTaskTitle}
                  >
                    {clusterIdx + 1}
                  </button>
                );
              }

              return (
                <div
                  key={`cluster-${clusterIdx}`}
                  data-admin-feedback-root="true"
                  className="pointer-events-auto absolute"
                  style={{
                    top: clamp(cluster.centroid.top, 12, window.innerHeight - 40),
                    left: clamp(cluster.centroid.left, 12, window.innerWidth - 56),
                  }}
                >
                  <button
                    type="button"
                    className="flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-orange-400 bg-orange-500 px-2 text-xs font-bold text-white shadow-lg"
                    onClick={() => setActiveMarkerId(cluster.markers[0].roadmapTaskId)}
                    title={`${cluster.markers.length} markers clustered`}
                  >
                    {cluster.markers.length}
                  </button>
                  {activeMarkerId && cluster.markers.some((m) => m.roadmapTaskId === activeMarkerId) ? (
                    <div className="absolute left-10 top-0 z-10 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                      {cluster.markers.map((m) => (
                        <button
                          key={m.roadmapTaskId}
                          type="button"
                          className={`block w-full truncate rounded px-2 py-1 text-left text-xs ${
                            m.roadmapTaskId === activeMarkerId
                              ? "bg-amber-100 font-semibold text-amber-900"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                          onClick={() => setActiveMarkerId(m.roadmapTaskId)}
                        >
                          {m.roadmapTaskTitle.replace(/^\[Feedback (Bug|Enhancement)\]\s+/, "")}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
            : null}

          {mode === "markers" && activeMarker ? (
            <div
              data-admin-feedback-root="true"
              className="pointer-events-auto absolute right-4 top-20 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
            >
              <div className="mb-2 text-sm font-semibold text-slate-900">{activeMarker.roadmapTaskTitle}</div>
              <div className="space-y-1 text-xs text-slate-600">
                <div>Task ID: {activeMarker.roadmapTaskId}</div>
                <div>Type: {activeMarker.feedbackType}</div>
                <div>Priority: {activeMarker.priority}</div>
                <div>Selector: {activeMarker.selector}</div>
                <div>Captured: {new Date(activeMarker.capturedAt).toLocaleString()}</div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setActiveMarkerId(null)}>
                  Close
                </Button>
                <Button type="button" variant="outline" onClick={openMarkerForEdit}>
                  Edit ticket
                </Button>
                <Button type="button" onClick={openRoadmap}>
                  Open roadmap
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>,
    document.body,
  );
}
