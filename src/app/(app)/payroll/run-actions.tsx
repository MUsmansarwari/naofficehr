"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { generateDraft, lockRun, unlockRun } from "@/lib/actions/payroll";

export function RunActions({ ym, exists, locked }: { ym: string; exists: boolean; locked: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [reason, setReason] = useState("");

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string } | { ok: true; count: number }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error);
      else setUnlocking(false);
    });

  return (
    <>
      {error && <span className="max-w-64 text-xs text-red">{error}</span>}

      {locked ? (
        <Button variant="outline" className="border-0 bg-white shadow-card" disabled={pending} onClick={() => setUnlocking(true)}>
          Unlock
        </Button>
      ) : (
        <>
          <Button variant="outline" className="border-0 bg-white shadow-card" disabled={pending} onClick={() => run(() => generateDraft(ym))}>
            {pending && <Spinner />}
            {pending ? "Working…" : exists ? "Regenerate draft" : "Generate draft"}
          </Button>
          {exists && (
            <Button variant="secondary" disabled={pending} onClick={() => run(() => lockRun(ym))}>
              {pending && <Spinner />}
              Lock payroll
            </Button>
          )}
        </>
      )}

      <Dialog open={unlocking} onOpenChange={setUnlocking}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Unlock this payroll</DialogTitle>
            <DialogDescription>
              Advance balances taken by this month go back. The reason is kept in the audit log.
            </DialogDescription>
          </DialogHeader>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being reopened?" autoFocus />
          {error && <p className="text-sm text-red">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setUnlocking(false)}>
              Cancel
            </Button>
            <Button disabled={pending || !reason.trim()} onClick={() => run(() => unlockRun(ym, reason))}>
              {pending && <Spinner />}
              Unlock
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
