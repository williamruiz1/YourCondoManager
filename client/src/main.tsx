import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initClientObservability } from "./lib/observability";

// Initialize observability (Sentry + GA4) BEFORE the React tree mounts so
// any boot-time errors are captured. Both surfaces no-op when their env
// var is absent — local dev requires no setup. See INSTALL-OBSERVABILITY.md.
void initClientObservability();

createRoot(document.getElementById("root")!).render(<App />);
