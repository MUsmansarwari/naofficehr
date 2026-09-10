"use client";

import { useActionState } from "react";
import { Card, CardBody, CardHeader } from "@/components/card";
import { FormError, FormOk } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/skeleton";
import type { Company } from "@/db/schema";
import { updateCompany } from "@/lib/actions/companies";
import type { FormState } from "@/lib/form";
import { CompanyFields } from "./company-fields";

export function CompanyForm({ company }: { company: Company }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateCompany.bind(null, company.id), {});
  return (
    <form action={action}>
      <Card>
        <CardHeader
          title="Company settings"
          right={
            <div className="flex items-center gap-3">
              <FormOk show={state.ok} />
              <Button type="submit" disabled={pending}>
                {pending && <Spinner />}
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-4">
          <FormError message={state.error} />
          <CompanyFields company={company} state={state} />
        </CardBody>
      </Card>
    </form>
  );
}
