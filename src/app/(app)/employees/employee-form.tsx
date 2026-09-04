"use client";

import { addMonths, format } from "date-fns";
import { useActionState, useState } from "react";
import { Field, FormError } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Company, Employee } from "@/db/schema";
import type { FormState } from "@/lib/form";

type Props = {
  company: Company;
  employee?: Employee;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  onCancel?: () => void;
  onSaved?: () => void;
  submitLabel?: string;
};

export function EmployeeForm({ company, employee, action, onCancel, onSaved, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(async (p, fd) => {
    const r = await action(p, fd);
    if (r.ok) onSaved?.();
    return r;
  }, {});
  const fe = state.fieldErrors ?? {};

  const [joinDate, setJoinDate] = useState(employee?.joinDate ?? format(new Date(), "yyyy-MM-dd"));
  const [months, setMonths] = useState(employee?.probationMonths ?? company.defaultProbationMonths);
  const autoEnd = /^\d{4}-\d{2}-\d{2}$/.test(joinDate) ? format(addMonths(new Date(joinDate + "T00:00:00"), months), "yyyy-MM-dd") : "";
  const isNew = !employee;

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state.error} />

      <section className="grid grid-cols-3 gap-4">
        <Field label="Code" htmlFor="code" error={fe.code}>
          <Input id="code" name="code" defaultValue={employee?.code} placeholder="E-014" required />
        </Field>
        <Field label="Full name" htmlFor="name" error={fe.name} className="col-span-2">
          <Input id="name" name="name" defaultValue={employee?.name} required />
        </Field>
        <Field label="Designation" htmlFor="designation">
          <Input id="designation" name="designation" defaultValue={employee?.designation ?? ""} />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={employee?.phone ?? ""} />
        </Field>
        <Field label="Email" htmlFor="email" error={fe.email}>
          <Input id="email" name="email" type="email" defaultValue={employee?.email ?? ""} />
        </Field>
        <Field label="CNIC" htmlFor="cnic">
          <Input id="cnic" name="cnic" defaultValue={employee?.cnic ?? ""} placeholder="35202-1234567-1" />
        </Field>
      </section>

      <section>
        <h3 className="mb-3 text-[13px] font-medium text-navy-70">Employment</h3>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Join date" htmlFor="joinDate" error={fe.joinDate}>
            <Input id="joinDate" name="joinDate" type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} required />
          </Field>
          <Field label="Probation (months)" htmlFor="probationMonths">
            <Input id="probationMonths" name="probationMonths" type="number" min={0} max={12} value={months} onChange={(e) => setMonths(Number(e.target.value))} />
          </Field>
          <Field label="Probation ends" htmlFor="probationEndDate" hint={autoEnd ? `Auto: ${autoEnd} — leave blank to use it` : undefined} error={fe.probationEndDate}>
            <Input id="probationEndDate" name="probationEndDate" type="date" defaultValue={employee?.probationEndDate ?? ""} placeholder={autoEnd} />
          </Field>
          {isNew && (
            <Field label={`Monthly salary (${company.currency})`} htmlFor="monthlySalary" error={fe.monthlySalary}>
              <Input id="monthlySalary" name="monthlySalary" inputMode="numeric" placeholder="150000" required />
            </Field>
          )}
          <Field label="Paid leave / year" htmlFor="leaveQuotaAnnual" hint={`Blank = company default (${company.defaultLeaveQuota})`}>
            <Input id="leaveQuotaAnnual" name="leaveQuotaAnnual" type="number" min={0} max={60} defaultValue={employee?.leaveQuotaAnnual ?? ""} />
          </Field>
          <Field label="Check-in PIN" htmlFor="checkinPin" error={fe.checkinPin} hint="4 digits, unique in company">
            <Input id="checkinPin" name="checkinPin" inputMode="numeric" pattern="\d{4}" maxLength={4} defaultValue={employee?.checkinPin ?? ""} />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-[13px] font-medium text-navy-70">Bank</h3>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Bank name" htmlFor="bankName">
            <Input id="bankName" name="bankName" defaultValue={employee?.bankName ?? ""} />
          </Field>
          <Field label="Account number" htmlFor="accountNumber">
            <Input id="accountNumber" name="accountNumber" defaultValue={employee?.accountNumber ?? ""} />
          </Field>
          <Field label="Notes" htmlFor="notes">
            <Input id="notes" name="notes" defaultValue={employee?.notes ?? ""} />
          </Field>
        </div>
      </section>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : (submitLabel ?? (isNew ? "Add employee" : "Save"))}
        </Button>
      </div>
    </form>
  );
}
