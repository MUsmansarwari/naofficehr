# NA Office HR

Internal attendance, leave and payroll tool. One manager, several companies, PKR, no tax.

The rules it implements — salary divisor, probation, leave quota, the midnight-crossing
shift, advances, payroll locking — are written down in [build-spec.md](build-spec.md).
The locked visual reference is [design/ui-mockup.html](design/ui-mockup.html).

## Running it locally

```bash
npm install
cp .env.example .env.local     # then edit it
npm run db:migrate
npm run dev
```

`.env.local` needs:

| Variable | What it is |
|---|---|
| `ADMIN_PASSWORD` | The single password for the manager |
| `SESSION_SECRET` | 32+ random characters, signs the session cookie |
| `DATABASE_URL` | `file:local.db` locally, `libsql://…turso.io` in production |
| `DATABASE_AUTH_TOKEN` | Turso token — production only |

Scripts: `npm test` (Vitest), `npm run typecheck`, `npm run lint`,
`npm run db:generate` (new migration after a schema change), `npm run db:studio`.

## Where things live

```
src/lib/payroll/compute.ts     the payroll engine — pure, per-day, fully tested
src/lib/attendance/resolve.ts  which day type a date is (weekly off → holiday → record → absent)
src/lib/attendance/time.ts     shift dates for a shift that crosses midnight
src/lib/advances/schedule.ts   installment projection
src/lib/backup.ts              JSON export / restore
src/db/schema.ts               every table
```

Money is always integer **paisa**. Dates are always `YYYY-MM-DD` strings, months `YYYY-MM`,
timestamps ISO UTC. A locked payslip is a snapshot and is never recomputed.

## Deploying (Netlify + Turso, free)

1. **Turso** — create a database, then take its URL and an auth token:
   ```bash
   turso db create na-office-hr
   turso db show na-office-hr --url
   turso db tokens create na-office-hr
   ```
2. **Migrate it once** from your machine:
   ```bash
   DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… npm run db:migrate
   ```
3. **Netlify** — import this repo (build settings come from `netlify.toml`) and set the four
   environment variables above. Use a strong `SESSION_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
4. Sign in, add your company in **Settings**, then the employees.

The public check-in page lives at `/checkin/<company-slug>` — no login, PIN only.

## Backups

**Settings → Backup** downloads every table as one JSON file. Restore replaces everything,
so the button stays disabled until you have downloaded the current data first — that
download is the undo. The file carries a `schema_version`; a restore from a different
version is refused rather than silently mangled.
