/**
 * Tracking utility for analytics and user interaction monitoring
 * Only sends data if user has consented to cookies
 */

export function hasConsentedToCookies(): boolean {
  if (typeof window === "undefined") return false;
  const consent = localStorage.getItem("cookie-consent");
  return consent === "accepted";
}

export function trackEvent(eventName: string, eventData: Record<string, any> = {}) {
  try {
    if (!hasConsentedToCookies()) {
      return; // Don't track if user hasn't consented
    }

    // Track with Google Analytics if available
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", eventName, {
        event_category: "user_interaction",
        ...eventData,
      });
    }

    // Also log for debugging in development
    if (process.env.NODE_ENV === "development") {
      console.debug("Analytics event:", eventName, eventData);
    }
  } catch (error) {
    console.error("Tracking error:", error);
  }
}

export function trackPageView(pageName: string, pageData: Record<string, any> = {}) {
  try {
    if (!hasConsentedToCookies()) {
      return;
    }

    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "page_view", {
        page_title: pageName,
        page_path: window.location.pathname,
        ...pageData,
      });
    }
  } catch (error) {
    console.error("Page view tracking error:", error);
  }
}

export function trackCTAClick(ctaType: string, location: string, label?: string) {
  trackEvent("cta_click", {
    cta_type: ctaType,
    location: location,
    label: label || "",
  });
}

export function trackFormSubmission(formName: string, data?: Record<string, any>) {
  trackEvent("form_submission", {
    form_name: formName,
    ...data,
  });
}

export function trackError(errorName: string, errorMessage?: string) {
  trackEvent("error_tracked", {
    error_name: errorName,
    error_message: errorMessage || "",
  });
}

export function trackUserScroll(scrollDepthPercent: number) {
  trackEvent("scroll_depth", {
    scroll_percent: scrollDepthPercent,
  });
}

export function trackSearchQuery(query: string) {
  trackEvent("search", {
    search_term: query,
  });
}

export function trackVideoPlay(videoTitle: string, videoId?: string) {
  trackEvent("video_play", {
    video_title: videoTitle,
    video_id: videoId || "",
  });
}
