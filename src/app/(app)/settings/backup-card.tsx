"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { useRef, useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { restoreBackup } from "@/lib/actions/backup";

type Preview = { name: string; json: string; rows: { table: string; rows: number }[]; exportedAt: string };

export function BackupCard({ lastBackupAt }: { lastBackupAt: string | null }) {
  const [downloaded, setDownloaded] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const age = lastBackupAt ? formatDistanceToNowStrict(new Date(lastBackupAt), { addSuffix: true }) : "never";

  async function pick(file: File) {
    setError(null);
    const json = await file.text();
    try {
      const parsed = JSON.parse(json);
      if (parsed?.app !== "na-office-hr") throw new Error("Not an NA Office HR backup");
      const rows = Object.entries(parsed.tables ?? {}).map(([table, list]) => ({
        table,
        rows: Array.isArray(list) ? list.length : 0,
      }));
      setPreview({ name: file.name, json, rows, exportedAt: parsed.exported_at ?? "unknown" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file");
    }
  }

  return (
    <Card>
      <CardHeader title="Backup" right={<span className="text-xs text-navy-45">last taken {age}</span>} />
      <CardBody className="space-y-4 text-[13px]">
        <p className="text-navy-70">
          Everything — companies, employees, salaries, attendance, advances, payroll — in one JSON file. Plain text, so the
          data stays readable even if you ever leave Turso.
        </p>

        <Button
          variant="secondary"
          className="w-full"
          nativeButton={false}
          render={<a href="/api/backup" download onClick={() => setDownloaded(true)} />}
        >
          Download backup
        </Button>

        <div className="border-t border-navy-06 pt-4">
          <div className="mb-1.5 font-medium">Restore from backup</div>
          <p className="mb-3 text-navy-70">
            This <b className="font-medium text-navy">replaces everything</b> currently in the app. Download the current
            data first — that download is your undo.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pick(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            className="w-full"
            disabled={!downloaded}
            onClick={() => fileRef.current?.click()}
            title={downloaded ? undefined : "Download a backup first"}
          >
            {downloaded ? "Choose a backup file…" : "Download a backup first"}
          </Button>
          {error && <p className="mt-2 text-red">{error}</p>}
          {done && <p className="mt-2 text-navy-70">{done}</p>}
        </div>
      </CardBody>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restore this backup?</DialogTitle>
            <DialogDescription>
              {preview?.name} · exported {preview?.exportedAt?.slice(0, 10)}. Everything in the app right now will be
              deleted and replaced.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-56 divide-y divide-navy-06 overflow-y-auto text-[13px]">
            {preview?.rows
              .filter((r) => r.rows > 0)
              .map((r) => (
                <li key={r.table} className="flex justify-between py-1.5">
                  <span className="text-navy-70">{r.table.replace(/_/g, " ")}</span>
                  <b className="font-medium">{r.rows}</b>
                </li>
              ))}
          </ul>
          {error && <p className="text-sm text-red">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  if (!preview) return;
                  setError(null);
                  const r = await restoreBackup(preview.json);
                  if (r.ok) {
                    const total = r.summary.reduce((s, x) => s + x.rows, 0);
                    setDone(`Restored ${total} rows from ${preview.name}.`);
                    setPreview(null);
                  } else setError(r.error);
                })
              }
            >
              {pending && <Spinner />}
              {pending ? "Restoring…" : "Replace everything"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
