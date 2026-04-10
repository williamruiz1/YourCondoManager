export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

/** Structured debug logging — suppressed in production. */
export function debug(label: string, data?: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  console.debug(label, data !== undefined ? data : "");
}
