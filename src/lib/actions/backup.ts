"use server";

import { revalidatePath } from "next/cache";
import { inspectBackup, restoreAll, type BackupSummary } from "@/lib/backup";
import { isAuthenticated } from "@/lib/auth";

export type RestoreResult = { ok: true; summary: BackupSummary } | { ok: false; error: string };

/**
 * Replaces every table with the uploaded backup. Destructive by design — the UI
 * makes the manager download the current data first (build-spec §6).
 */
export async function restoreBackup(json: string): Promise<RestoreResult> {
  if (!(await isAuthenticated())) return { ok: false, error: "Not signed in" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file is not valid JSON" };
  }
  const check = inspectBackup(parsed);
  if (!check.ok) return { ok: false, error: check.error };

  try {
    await restoreAll(check.file);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restore failed" };
  }
  revalidatePath("/", "layout");
  return { ok: true, summary: check.summary };
}
