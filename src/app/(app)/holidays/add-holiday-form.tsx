"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, FormError } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/skeleton";
import { Input } from "@/components/ui/input";
import { addHoliday } from "@/lib/actions/holidays";
import type { FormState } from "@/lib/form";

export function AddHolidayForm({ year }: { year: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addHoliday, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  const fe = state.fieldErrors ?? {};
  const v = (name: string, fallback = "") => state.values?.[name] ?? fallback;
  return (
    <form ref={ref} action={action} className="space-y-4 px-5 py-4">
      <FormError message={state.error} />
      <Field label="Date" htmlFor="date" error={fe.date}>
        <Input id="date" name="date" type="date" defaultValue={v("date")} min={`${year}-01-01`} max={`${year}-12-31`} required />
      </Field>
      <Field label="Name" htmlFor="name" error={fe.name}>
        <Input id="name" name="name" defaultValue={v("name")} placeholder="Eid ul-Fitr" required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Spinner />}
        {pending ? "Adding…" : "Add holiday"}
      </Button>
    </form>
  );
}
