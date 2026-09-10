"use client";

import { useActionState, useEffect } from "react";
import { Field, FormError } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Payslip } from "@/db/schema";
import { updateAdjustments } from "@/lib/actions/payroll";
import type { FormState } from "@/lib/form";
import { fmtMoney, toRupees } from "@/lib/money";

export function AdjustDialog({
  payslip,
  employeeName,
  onClose,
}: {
  payslip: Payslip;
  employeeName: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateAdjustments.bind(null, payslip.id), {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);
  const fe = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | number) => state.values?.[name] ?? String(fallback);
  const beforeAdjustments = payslip.baseAmount - payslip.deductionAmount - payslip.advanceDeduction;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust · {employeeName}</DialogTitle>
          <DialogDescription>
            Before adjustments: {fmtMoney(beforeAdjustments)} — base {fmtMoney(payslip.baseAmount)} less deductions{" "}
            {fmtMoney(payslip.deductionAmount)} and advance {fmtMoney(payslip.advanceDeduction)}.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <FormError message={state.error} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Addition (bonus, arrears)" htmlFor="otherAdditions">
              <Input id="otherAdditions" name="otherAdditions" inputMode="numeric" defaultValue={v("otherAdditions", payslip.otherAdditions ? toRupees(payslip.otherAdditions) : "")} placeholder="0" />
            </Field>
            <Field label="Note" htmlFor="otherAdditionsNote" error={fe.otherAdditionsNote}>
              <Input id="otherAdditionsNote" name="otherAdditionsNote" defaultValue={v("otherAdditionsNote", payslip.otherAdditionsNote ?? "")} placeholder="Eid bonus" />
            </Field>
            <Field label="Deduction" htmlFor="otherDeductions">
              <Input id="otherDeductions" name="otherDeductions" inputMode="numeric" defaultValue={v("otherDeductions", payslip.otherDeductions ? toRupees(payslip.otherDeductions) : "")} placeholder="0" />
            </Field>
            <Field label="Note" htmlFor="otherDeductionsNote" error={fe.otherDeductionsNote}>
              <Input id="otherDeductionsNote" name="otherDeductionsNote" defaultValue={v("otherDeductionsNote", payslip.otherDeductionsNote ?? "")} placeholder="Equipment recovery" />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
