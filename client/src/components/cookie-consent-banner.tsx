import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [preference, setPreference] = useState<"accepted" | "rejected" | null>(null);

  useEffect(() => {
    // Check if user has already made a choice
    const savedPreference = localStorage.getItem("cookie-consent");
    if (savedPreference) {
      setPreference(savedPreference as "accepted" | "rejected");
    } else {
      // Show banner if no preference is saved
      setShowBanner(true);
    }
  }, []);

  useEffect(() => {
    // Load tracking script if consent is given
    if (preference === "accepted") {
      loadGoogleAnalytics();
    }
  }, [preference]);

  const loadGoogleAnalytics = () => {
    // Load Google Analytics
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX";
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", "G-XXXXXXXXXX", {
      anonymize_ip: true,
    });

    // Also initialize other tracking
    initializeTracking();
  };

  const initializeTracking = () => {
    // Set analytics cookies
    if (typeof window !== "undefined") {
      // Track page views
      const trackPageView = () => {
        if ((window as any).gtag) {
          (window as any).gtag("event", "page_view", {
            page_path: window.location.pathname,
            page_title: document.title,
          });
        }
      };

      // Track on route change
      trackPageView();
    }
  };

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setPreference("accepted");
    setShowBanner(false);
  };

  const handleReject = () => {
    localStorage.setItem("cookie-consent", "rejected");
    setPreference("rejected");
    setShowBanner(false);
  };

  if (!showBanner || preference) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Cookie Consent
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            We use cookies to enhance your experience, analyze site traffic, and serve you personalized content. By continuing to use this site, you consent to our use of cookies. You can manage your preferences or learn more by visiting our{" "}
            <a
              href="/privacy-policy"
              className="text-primary hover:underline font-medium"
            >
              Privacy Policy
            </a>
            {" "}and{" "}
            <button
              onClick={() => {
                localStorage.removeItem("cookie-consent");
                window.location.reload();
              }}
              className="text-primary hover:underline font-medium cursor-pointer"
            >
              Cookie Settings
            </button>
            .
          </p>
        </div>

        <div className="flex gap-3 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReject}
            className="whitespace-nowrap"
          >
            Reject
          </Button>
          <Button
            size="sm"
            onClick={handleAccept}
            className="whitespace-nowrap"
          >
            Accept
          </Button>
        </div>

        <button
          onClick={handleReject}
          className="md:hidden flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          aria-label="Close cookie consent"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
