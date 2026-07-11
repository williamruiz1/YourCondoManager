// CQ-001 lint fixture — an intentional floating promise. `lint:server` MUST
// flag this with @typescript-eslint/no-floating-promises. Referenced only by
// server/__tests__/lint-server-config.test.ts (never imported by app code).
async function money(): Promise<void> {}
export function leak(): void {
  money(); // floating promise — unhandled rejection risk in a money path
}
