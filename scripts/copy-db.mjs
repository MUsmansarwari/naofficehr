// Copies every table from one libsql database to another, in FK order.
// Usage: SOURCE_URL=file:local.db TARGET_URL=libsql://… TARGET_TOKEN=… node scripts/copy-db.mjs
import { createClient } from "@libsql/client";

const TABLES = [
  "settings", "companies", "employees", "salary_structures", "holidays", "attendance",
  "advances", "payroll_runs", "payslips", "advance_installments", "checkin_attempts", "audit_log",
];

const src = createClient({ url: process.env.SOURCE_URL ?? "file:local.db" });
const dst = createClient({ url: process.env.TARGET_URL, authToken: process.env.TARGET_TOKEN });

for (const t of [...TABLES].reverse()) await dst.execute(`delete from ${t}`);
for (const t of TABLES) {
  const { columns, rows } = await src.execute(`select * from ${t}`);
  if (rows.length === 0) { console.log(`${t.padEnd(22)} 0`); continue; }
  const cols = columns.map((c) => `"${c}"`).join(",");
  const marks = columns.map(() => "?").join(",");
  const stmts = rows.map((r) => ({ sql: `insert into ${t} (${cols}) values (${marks})`, args: columns.map((c) => r[c]) }));
  for (let i = 0; i < stmts.length; i += 100) await dst.batch(stmts.slice(i, i + 100), "write");
  console.log(`${t.padEnd(22)} ${rows.length}`);
}
