"use client";

import { Checkbox, Field, NativeSelect } from "@/components/form/field";
import { TimeInput12h } from "@/components/form/time-input-12h";
import { Input } from "@/components/ui/input";
import type { Company } from "@/db/schema";
import type { FormState } from "@/lib/form";
import { TIMEZONES } from "@/lib/timezones";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Shared inputs for create + edit. `company` undefined = defaults. */
export function CompanyFields({ company, state }: { company?: Company; state: FormState }) {
  const fe = state.fieldErrors ?? {};
  // Re-fill from the rejected submission — React clears an uncontrolled form after its action.
  const sent = state.values;
  const v = (name: string, fallback: string | number | undefined) => sent?.[name] ?? String(fallback ?? "");
  const checked = (name: string, fallback: boolean) => (sent ? sent[name] === "on" : fallback);
  const offs = sent ? (sent.weeklyOffs ?? "").split(",").filter(Boolean).map(Number) : (company?.weeklyOffs ?? [0, 6]);
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4">
        <Field label="Company name" htmlFor="name" error={fe.name}>
          <Input id="name" name="name" defaultValue={v("name", company?.name)} required />
        </Field>
        <Field label="Slug (check-in URL)" htmlFor="slug" error={fe.slug} hint="/checkin/<slug> — lowercase, dashes">
          <Input id="slug" name="slug" defaultValue={v("slug", company?.slug)} required pattern="[a-z0-9-]+" />
        </Field>
        <Field label="Timezone" htmlFor="timezone">
          <NativeSelect id="timezone" name="timezone" defaultValue={v("timezone", company?.timezone ?? "Asia/Karachi")}>
            {TIMEZONES.map((tz) => (
              <option key={tz}>{tz}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Currency" htmlFor="currency">
          <Input id="currency" name="currency" defaultValue={v("currency", company?.currency ?? "PKR")} maxLength={3} />
        </Field>
      </section>

      <section>
        <h3 className="mb-3 text-[13px] font-medium text-navy-70">Office hours</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Shift start">
            <TimeInput12h name="shiftStart" defaultValue={company?.shiftStart ?? "20:00"} />
          </Field>
          <Field label="Shift end" hint="End before start = shift crosses midnight (Friday 8 PM → Saturday 5 AM counts as Friday)">
            <TimeInput12h name="shiftEnd" defaultValue={company?.shiftEnd ?? "05:00"} />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-[13px] font-medium text-navy-70">Weekly offs (paid)</h3>
        <div className="flex flex-wrap gap-4">
          {DAYS.map((d, i) => (
            <Checkbox key={d} name="weeklyOffs" value={i} label={d} defaultChecked={offs.includes(i)} />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-4">
        <Field label="Salary divisor" htmlFor="salaryDivisor" hint="per-day = salary ÷ divisor" error={fe.salaryDivisor}>
          <Input id="salaryDivisor" name="salaryDivisor" type="number" min={1} max={31} defaultValue={v("salaryDivisor", company?.salaryDivisor ?? 30)} />
        </Field>
        <Field label="Default probation (months)" htmlFor="defaultProbationMonths">
          <Input id="defaultProbationMonths" name="defaultProbationMonths" type="number" min={0} max={12} defaultValue={v("defaultProbationMonths", company?.defaultProbationMonths ?? 3)} />
        </Field>
        <Field label="Default paid leave / year" htmlFor="defaultLeaveQuota">
          <Input id="defaultLeaveQuota" name="defaultLeaveQuota" type="number" min={0} max={60} defaultValue={v("defaultLeaveQuota", company?.defaultLeaveQuota ?? 8)} />
        </Field>
      </section>

      <section className="space-y-3">
        <Checkbox
          name="deductPublicHolidaysInProbation"
          defaultChecked={checked("deductPublicHolidaysInProbation", company?.deductPublicHolidaysInProbation ?? false)}
          label={
            <span>
              Deduct public holidays during probation{" "}
              <span className="text-navy-45">— off by default; office is closed, not the employee’s fault</span>
            </span>
          }
        />
        <Checkbox name="checkinEnabled" defaultChecked={checked("checkinEnabled", company?.checkinEnabled ?? true)} label="Public check-in page enabled" />
      </section>
    </div>
  );
}
