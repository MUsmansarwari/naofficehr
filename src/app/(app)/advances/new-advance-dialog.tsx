"use client";

import { format } from "date-fns";
import { useActionState, useEffect, useState } from "react";
import { Field, FormError, NativeSelect } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createAdvance } from "@/lib/actions/advances";
import { installmentSchedule, monthLabel } from "@/lib/advances/schedule";
import type { FormState } from "@/lib/form";
import { fmtMoney } from "@/lib/money";

type Candidate = { id: number; name: string; code: string };

export function NewAdvanceDialog({ candidates, currency }: { candidates: Candidate[]; currency: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(createAdvance, {});
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  const v = (name: string, fallback = "") => state.values?.[name] ?? fallback;
  const [amount, setAmount] = useState("");
  const [installment, setInstallment] = useState("");
  const [startMonth, setStartMonth] = useState(format(new Date(), "yyyy-MM"));
  const fe = state.fieldErrors ?? {};

  const preview = installmentSchedule({
    remaining: Math.round(Number(amount.replace(/[,\s]/g, "")) * 100) || 0,
    installment: Math.round(Number(installment.replace(/[,\s]/g, "")) * 100) || 0,
    startMonth: /^\d{4}-\d{2}$/.test(startMonth) ? startMonth : "2026-01",
    maxRows: 24,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" />} disabled={candidates.length === 0}>
        New advance
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New advance</DialogTitle>
          <DialogDescription>Payroll takes one installment a month from the start month, oldest advance first.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <FormError message={state.error} />

          <Field label="Employee" htmlFor="employeeId" error={fe.employeeId}>
            <NativeSelect id="employeeId" name="employeeId" defaultValue={v("employeeId")} required>
              <option value="">Select…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.code}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Amount (${currency})`} htmlFor="amount" error={fe.amount}>
              <Input id="amount" name="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" required />
            </Field>
            <Field label={`Monthly installment (${currency})`} htmlFor="installmentAmount" error={fe.installmentAmount}>
              <Input
                id="installmentAmount"
                name="installmentAmount"
                inputMode="numeric"
                value={installment}
                onChange={(e) => setInstallment(e.target.value)}
                placeholder="10000"
                required
              />
            </Field>
            <Field label="Given on" htmlFor="givenOn" error={fe.givenOn}>
              <Input id="givenOn" name="givenOn" type="date" defaultValue={v("givenOn", format(new Date(), "yyyy-MM-dd"))} required />
            </Field>
            <Field label="First deduction month" htmlFor="startMonth" error={fe.startMonth}>
              <Input id="startMonth" name="startMonth" type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} required />
            </Field>
          </div>

          <Field label="Reason" htmlFor="reason">
            <Input id="reason" name="reason" defaultValue={v("reason")} placeholder="Medical emergency" />
          </Field>

          {preview.length > 0 && (
            <div className="rounded-lg bg-chalk px-4 py-3 text-[13px]">
              <div className="mb-1.5 font-medium">
                {preview.length} installment{preview.length === 1 ? "" : "s"} · {monthLabel(preview[0].month)} to{" "}
                {monthLabel(preview[preview.length - 1].month)}
              </div>
              <div className="text-navy-70">
                {preview
                  .slice(0, 3)
                  .map((r) => `${monthLabel(r.month)} ${fmtMoney(r.amount)}`)
                  .join(" · ")}
                {preview.length > 4 && " · …"}
                {preview.length > 3 && ` · ${monthLabel(preview[preview.length - 1].month)} ${fmtMoney(preview[preview.length - 1].amount)}`}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              {pending ? "Saving…" : "Give advance"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
