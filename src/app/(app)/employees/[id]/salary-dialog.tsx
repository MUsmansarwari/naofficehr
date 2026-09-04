"use client";

import { format } from "date-fns";
import { useActionState, useEffect, useState } from "react";
import { Field, FormError } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { changeSalary } from "@/lib/actions/employees";
import type { FormState } from "@/lib/form";

export function SalaryDialog({ employeeId, currency }: { employeeId: number; currency: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(changeSalary.bind(null, employeeId), {});
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);
  const fe = state.fieldErrors ?? {};
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Change salary</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change salary</DialogTitle>
          <DialogDescription>Adds a new row; the old salary stays locked for past months.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <FormError message={state.error} />
          <Field label={`New monthly salary (${currency})`} htmlFor="monthlySalary" error={fe.monthlySalary}>
            <Input id="monthlySalary" name="monthlySalary" inputMode="numeric" required autoFocus />
          </Field>
          <Field label="Effective from" htmlFor="effectiveFrom" error={fe.effectiveFrom} hint="Usually the 1st of a month">
            <Input id="effectiveFrom" name="effectiveFrom" type="date" defaultValue={format(new Date(), "yyyy-MM-01")} required />
          </Field>
          <Field label="Note" htmlFor="note">
            <Input id="note" name="note" placeholder="Annual increment" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
