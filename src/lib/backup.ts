import "server-only";
import { db, schema } from "@/db";

/** Bump when a migration changes the shape of any exported table. */
export const SCHEMA_VERSION = 1;

/** Parents first — restore inserts in this order, and deletes in reverse. */
const TABLES = [
  ["settings", schema.settings],
  ["companies", schema.companies],
  ["employees", schema.employees],
  ["salary_structures", schema.salaryStructures],
  ["holidays", schema.holidays],
  ["attendance", schema.attendance],
  ["advances", schema.advances],
  ["payroll_runs", schema.payrollRuns],
  ["payslips", schema.payslips],
  ["advance_installments", schema.advanceInstallments],
  ["checkin_attempts", schema.checkinAttempts],
  ["audit_log", schema.auditLog],
] as const;

export type BackupFile = {
  app: "na-office-hr";
  schema_version: number;
  exported_at: string;
  tables: Record<string, Record<string, unknown>[]>;
};

export async function exportAll(): Promise<BackupFile> {
  const tables: BackupFile["tables"] = {};
  for (const [name, table] of TABLES) {
    tables[name] = (await db.select().from(table)) as Record<string, unknown>[];
  }
  return {
    app: "na-office-hr",
    schema_version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    tables,
  };
}

export type BackupSummary = { table: string; rows: number }[];

/** Shape check plus the row counts the confirm dialog shows. */
export function inspectBackup(raw: unknown): { ok: true; file: BackupFile; summary: BackupSummary } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Not a backup file" };
  const file = raw as Partial<BackupFile>;
  if (file.app !== "na-office-hr") return { ok: false, error: "This file is not an NA Office HR backup" };
  if (typeof file.schema_version !== "number") {
    return { ok: false, error: "Backup has no schema_version — it cannot be restored safely" };
  }
  if (file.schema_version > SCHEMA_VERSION) {
    return { ok: false, error: `Backup is version ${file.schema_version}, this app understands ${SCHEMA_VERSION}. Update the app first.` };
  }
  if (file.schema_version < SCHEMA_VERSION) {
    return { ok: false, error: `Backup is version ${file.schema_version}, this app is on ${SCHEMA_VERSION}. No migration path exists yet.` };
  }
  if (typeof file.tables !== "object" || file.tables === null) return { ok: false, error: "Backup has no tables" };

  const summary: BackupSummary = [];
  for (const [name] of TABLES) {
    const rows = file.tables[name];
    if (rows !== undefined && !Array.isArray(rows)) return { ok: false, error: `Table ${name} is malformed` };
    summary.push({ table: name, rows: rows?.length ?? 0 });
  }
  return { ok: true, file: file as BackupFile, summary };
}

/** Replaces everything. The caller must have made the user download a copy first. */
export async function restoreAll(file: BackupFile): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [, table] of [...TABLES].reverse()) {
      await tx.delete(table);
    }
    for (const [name, table] of TABLES) {
      const rows = file.tables[name] ?? [];
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        if (chunk.length === 0) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await tx.insert(table).values(chunk as any);
      }
    }
  });
}

export async function markBackupTaken(): Promise<void> {
  await db
    .insert(schema.settings)
    .values({ id: 1, schemaVersion: SCHEMA_VERSION, lastBackupAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: schema.settings.id,
      set: { lastBackupAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    });
}
