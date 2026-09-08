"use client";

import { useState } from "react";
import { Field } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AttendanceStatus } from "@/db/schema";
import type { ResolvedStatus } from "@/lib/attendance/resolve";
import { cn } from "@/lib/utils";
import { STATUS_META } from "./grid";

export type CellDraft = {
  status: AttendanceStatus | null; // null = no manual override (auto)
  checkIn: string; // 'h:mm AM' or ''
  checkOut: string;
  note: string;
  source: "none" | "check-in" | "override";
};

export function CellDialog({
  employeeName,
  dateLabel,
  current,
  draft,
  onClose,
  onApply,
}: {
  employeeName: string;
  date: string;
  dateLabel: string;
  current: ResolvedStatus;
  draft: CellDraft;
  onClose: () => void;
  onApply: (d: CellDraft) => void;
}) {
  const [d, setD] = useState(draft);
  const statuses = Object.keys(STATUS_META) as AttendanceStatus[];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {employeeName} · {dateLabel}
          </DialogTitle>
          <DialogDescription>
            Currently <b className="text-navy">{current === "future" ? "not marked" : current === "skip" ? "—" : STATUS_META[current].label}</b>
            {draft.source === "override" && " (manager override)"}
            {draft.source === "check-in" && " (from check-in)"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1.5">
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setD({ ...d, status: s })}
              className={cn(
                "flex items-center gap-2 rounded-lg bg-chalk px-2.5 py-2 text-left text-xs text-navy",
                d.status === s && "bg-white outline outline-2 outline-navy",
              )}
            >
              <i className={cn("inline-block size-3 rounded-[3px] border border-navy-06", STATUS_META[s].swatch)} />
              {STATUS_META[s].label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setD({ ...d, status: null })}
            className={cn("col-span-2 rounded-lg px-2.5 py-2 text-left text-xs text-navy-70", d.status === null && "bg-chalk outline outline-2 outline-navy")}
          >
            Auto — no override (weekly off / holiday / check-in / absent)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Check in" htmlFor="ci" hint="e.g. 8:04 PM">
            <Input id="ci" value={d.checkIn} onChange={(e) => setD({ ...d, checkIn: e.target.value })} placeholder="—" />
          </Field>
          <Field label="Check out" htmlFor="co" hint="e.g. 4:58 AM">
            <Input id="co" value={d.checkOut} onChange={(e) => setD({ ...d, checkOut: e.target.value })} placeholder="—" />
          </Field>
        </div>
        <Field label="Note" htmlFor="note">
          <Input id="note" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder="called in sick, quota over" />
        </Field>

        <div className="flex items-center justify-between">
          <span className="text-xs text-navy-45">Applied on save · logged</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => onApply(d)}>
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
