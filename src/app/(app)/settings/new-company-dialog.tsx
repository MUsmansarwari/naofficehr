"use client";

import { useActionState, useEffect, useState } from "react";
import { FormError } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createCompany } from "@/lib/actions/companies";
import type { FormState } from "@/lib/form";
import { CompanyFields } from "./company-fields";

export function NewCompanyDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(createCompany, {});
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" />}>Add company</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New company</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-5">
          <FormError message={state.error} />
          <CompanyFields state={state} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              {pending ? "Creating…" : "Create company"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
