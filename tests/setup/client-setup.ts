import "@testing-library/jest-dom/vitest";

// CI greenup (fix/ci-greenup): a handful of server-side tests import a route
// module that transitively imports `server/db.ts`, which throws at import time
// unless `DATABASE_URL` is set (see server/db.ts). Those tests only exercise
// pure functions (e.g. `parseBulkPaste`) and never issue a query — the `pg.Pool`
// is lazy and won't connect until a query runs. Provide a stub connection
// string so the import guard passes under `npx vitest run` (the CI test job,
// which has no Postgres service). A real DATABASE_URL — e.g. a CI Postgres
// service or local dev DB — still takes precedence because we only set it when
// it's absent.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgres://ci-stub:ci-stub@127.0.0.1:5432/ci_stub";
}
