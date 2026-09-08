"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Field, FormError } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Advance } from "@/db/schema";
import { closeAdvance, reopenAdvance, setAdvanceStatus, updateAdvance } from "@/lib/actions/advances";
import type { InstallmentRow } from "@/lib/advances/queries";
import { installmentSchedule, monthLabel, nextMonth } from "@/lib/advances/schedule";
import type { FormState } from "@/lib/form";
import { fmtMoney, toRupees } from "@/lib/money";

export function AdvanceActions({
  advance,
  employeeName,
  installments,
  currency,
}: {
  advance: Advance;
  employeeName: string;
  installments: InstallmentRow[];
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [state, action, saving] = useActionState<FormState, FormData>(updateAdvance.bind(null, advance.id), {});
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  const closed = advance.status === "closed";
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;

  // What is still to come. A draft installment is already listed above but has
  // not moved the balance yet, so take it off the projection.
  const lastRecorded = installments.length ? installments[installments.length - 1].month : null;
  const inDraft = installments.filter((i) => !i.locked).reduce((sum, i) => sum + i.amount, 0);
  const upcoming = installmentSchedule({
    remaining: advance.remainingAmount - inDraft,
    installment: advance.installmentAmount,
    startMonth: lastRecorded ? nextMonth(lastRecorded) : advance.startMonth,
    maxRows: 24,
  });

  return (
    <>
      <div className="flex justify-end gap-1">
        {!closed && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => setAdvanceStatus(advance.id, advance.status === "paused" ? "active" : "paused"))}>
            {advance.status === "paused" ? "Resume" : "Pause"}
          </Button>
        )}
        {closed && advance.remainingAmount > 0 && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => reopenAdvance(advance.id))}>
            Reopen
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          Details
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{employeeName} · advance</DialogTitle>
            <DialogDescription>
              {fmtMoney(advance.amount)} given, {fmtMoney(advance.amount - advance.remainingAmount)} recovered,{" "}
              <b className="text-navy">{fmtMoney(advance.remainingAmount)}</b> {closed ? "waived" : "outstanding"}.
            </DialogDescription>
          </DialogHeader>

          <div>
            <h3 className="mb-2 text-[13px] font-medium text-navy-70">Installments</h3>
            {installments.length === 0 && upcoming.length === 0 && <p className="text-[13px] text-navy-45">Nothing scheduled.</p>}
            <ul className="divide-y divide-navy-06 text-[13px]">
              {installments.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-1.5">
                  <span>{monthLabel(i.month)}</span>
                  <span className="flex items-center gap-2">
                    {fmtMoney(i.amount)}
                    <span className="text-xs text-navy-45">{i.locked ? "taken" : "in draft"}</span>
                  </span>
                </li>
              ))}
              {!closed &&
                upcoming.map((u) => (
                  <li key={u.month} className="flex items-center justify-between py-1.5 text-navy-70">
                    <span>{monthLabel(u.month)}</span>
                    <span className="flex items-center gap-2">
                      {fmtMoney(u.amount)}
                      <span className="text-xs text-navy-45">projected</span>
                    </span>
                  </li>
                ))}
            </ul>
          </div>

          {!closed && (
            <form action={action} className="space-y-3 border-t border-navy-06 pt-4">
              <FormError message={state.error} />
              <div className="grid grid-cols-2 gap-3">
                <Field label={`Monthly installment (${currency})`} htmlFor="installmentAmount" error={state.fieldErrors?.installmentAmount}>
                  <Input
                    id="installmentAmount"
                    name="installmentAmount"
                    inputMode="numeric"
                    defaultValue={v("installmentAmount", String(toRupees(advance.installmentAmount)))}
                    required
                  />
                </Field>
                <Field label="Reason" htmlFor="reason">
                  <Input id="reason" name="reason" defaultValue={v("reason", advance.reason ?? "")} />
                </Field>
              </div>
              <Field label="Note" htmlFor="note">
                <Input id="note" name="note" defaultValue={v("note", advance.note ?? "")} />
              </Field>
              <p className="text-xs text-navy-45">
                The amount and the date it was given cannot change — close this one and enter a new advance instead.
              </p>
              <div className="flex items-center justify-between">
                <Button type="button" variant="destructive" size="sm" onClick={() => setClosing(true)}>
                  Close early
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </form>
          )}
          {closed && advance.note && <p className="border-t border-navy-06 pt-4 text-[13px] text-navy-70">{advance.note}</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={closing} onOpenChange={setClosing}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Close this advance</DialogTitle>
            <DialogDescription>
              {advance.remainingAmount > 0 ? (
                <>
                  {fmtMoney(advance.remainingAmount)} is still owed. Closing writes it off — payroll stops deducting and the
                  amount stays on the record as waived.
                </>
              ) : (
                <>Nothing is owed. Closing just files it away.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is it being closed?" autoFocus />
          {error && <p className="text-sm text-red">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setClosing(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || !reason.trim()}
              onClick={() =>
                start(async () => {
                  const r = await closeAdvance(advance.id, reason);
                  if (r.ok) {
                    setClosing(false);
                    setOpen(false);
                  } else setError(r.error);
                })
              }
            >
              Close advance
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
