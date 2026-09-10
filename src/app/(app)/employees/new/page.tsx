import { Card, CardBody } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { createEmployee } from "@/lib/actions/employees";
import { requireActiveCompany } from "@/lib/company";
import { EmployeeForm } from "../employee-form";

export default async function NewEmployeePage() {
  const company = await requireActiveCompany();
  return (
    <>
      <PageHeader
        title="Add employee"
        subtitle={company.name}
        back={{ href: "/employees", label: "Employees" }}
      />
      <Card className="max-w-4xl">
        <CardBody>
          <EmployeeForm company={company} action={createEmployee} />
        </CardBody>
      </Card>
    </>
  );
}
