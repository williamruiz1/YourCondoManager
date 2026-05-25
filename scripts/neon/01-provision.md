# Step 01 — Provision Neon Project + Database

**Time:** ~5 minutes. **Who runs this:** William (UI step — requires founder auth).
**Output:** `NEON_DATABASE_URL_POOLED` (production string) + `NEON_DATABASE_URL_DIRECT` (direct, for migrations and pg_restore).

This is the only step in the migration that needs William's hands on a browser. Everything after it is scripted.

---

## 1. Create the Neon project

1. Open https://console.neon.tech/app/projects → **New Project**.
2. **Project name:** `yourcondomanager-prod`
3. **Postgres version:** **17** (must match the Fly Postgres major version; current Fly image is `flyio/postgres-flex:17.x`).
4. **Region:** **AWS US East (N. Virginia) — `aws-us-east-1`**. This is the closest Neon region to Fly's `ewr` (Newark) where the app machines run. Round-trip latency from `ewr` → `us-east-1` is single-digit ms.
5. **Compute size:** start at **0.25 CU autoscaling up to 1 CU**. (Free tier — fine for current YCM load. Upgrade later if needed.)
6. Click **Create project**.

## 2. Capture both connection strings

After the project is created, Neon shows a **Connection Details** panel. We need BOTH of these — the migration uses the direct connection (faster bulk import; no pooler involved) and production runtime uses the pooled connection.

1. **Pooled connection** (for production runtime — this is what `DATABASE_URL` becomes):
   - In the connection-details panel, toggle **Pooled connection: ON**.
   - Copy the full string. It looks like:
     ```
     postgresql://<user>:<password>@<endpoint>-pooler.aws-us-east-1.neon.tech/<dbname>?sslmode=require&channel_binding=require
     ```
   - Note the `-pooler` infix in the hostname — that's how you know it's the pooled string.

2. **Direct connection** (for the one-time import + drizzle migrations):
   - Toggle **Pooled connection: OFF**.
   - Copy the full string. Same shape, but **no `-pooler`** infix.
   - It looks like:
     ```
     postgresql://<user>:<password>@<endpoint>.aws-us-east-1.neon.tech/<dbname>?sslmode=require&channel_binding=require
     ```

## 3. Store both strings somewhere safe (locally, ephemeral)

Open a terminal on William's Mac and export both as env vars in the same shell you'll run the migration scripts from:

```bash
export NEON_DATABASE_URL_POOLED='postgresql://...-pooler.aws-us-east-1.neon.tech/...?sslmode=require'
export NEON_DATABASE_URL_DIRECT='postgresql://...aws-us-east-1.neon.tech/...?sslmode=require'
```

**Do NOT commit either to git, and do NOT paste them into a PR or Issue body.** They're production credentials. The Fly secret takes over the production copy at cutover step 04.

## 4. Smoke-test the connection (10 seconds)

```bash
psql "$NEON_DATABASE_URL_DIRECT" -c 'select version();'
```

Should print something like `PostgreSQL 17.x on x86_64-pc-linux-gnu, compiled by gcc ...`. If you get a connection error, the most common causes are:

- Missing `?sslmode=require` at the end of the URL — Neon requires SSL.
- Copy-paste truncated the password — re-copy the whole string from Neon's UI.

## 5. Done — proceed to step 02

Once both env vars are exported and the smoke test prints a version, you're ready to run `02-export-fly-postgres.sh`.

---

## Notes

- **Why both URLs?** Neon's pooler (PgBouncer in transaction mode) is great for production runtime — it multiplexes thousands of short-lived app connections onto a small number of Postgres backends, which is exactly what a Node app pool needs. But the pooler does NOT support `SET` statements, prepared statements, or `COPY` reliably — both of which `pg_restore` and Drizzle's migrator use. So the migration runs over the direct URL, and production runtime runs over the pooled URL.
- **Both strings target the same physical database.** Same data, same migrations. Only the routing layer differs.
- **`channel_binding=require`** is the modern Neon default — leave it on; the `pg` Node client and `pg_restore` both support it.
