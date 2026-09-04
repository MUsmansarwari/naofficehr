"use client";

import { format } from "date-fns";
import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/card";
import { Button } from "@/components/ui/button";
import type { Company, Employee, SalaryStructure } from "@/db/schema";
import { updateEmployee } from "@/lib/actions/employees";
import { fmtMoney } from "@/lib/money";
import { EmployeeForm } from "../employee-form";

function d(ymd: string) {
  return format(new Date(ymd + "T00:00:00"), "MMM d, yyyy");
}

export function DetailsCard({ company, employee, salary }: { company: Company; employee: Employee; salary: SalaryStructure | null }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <Card>
        <CardHeader title="Edit details" />
        <CardBody>
          <EmployeeForm
            company={company}
            employee={employee}
            action={updateEmployee.bind(null, employee.id)}
            onCancel={() => setEditing(false)}
            onSaved={() => setEditing(false)}
          />
        </CardBody>
      </Card>
    );
  }

  const items: [string, React.ReactNode][] = [
    ["Phone", employee.phone],
    ["Email", employee.email],
    ["CNIC", employee.cnic],
    ["Salary", salary ? <>{fmtMoney(salary.monthlySalary)} <span className="text-xs text-navy-45">since {d(salary.effectiveFrom)}</span></> : null],
    ["Leave quota", employee.leaveQuotaAnnual != null ? `${employee.leaveQuotaAnnual} / year` : <>{company.defaultLeaveQuota} / year <span className="text-xs text-navy-45">(company default)</span></>],
    ["Check-in PIN", employee.checkinPin ? "••••" : <span className="text-navy-45">not set</span>],
    ["Bank", employee.bankName],
    ["Account", employee.accountNumber],
    ["Probation", <>{employee.probationMonths} months · ends {d(employee.probationEndDate)}</>],
    ["Notes", employee.notes],
  ];

  return (
    <Card>
      <CardHeader
        title="Details"
        right={
          employee.status === "active" && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Edit details
            </Button>
          )
        }
      />
      <CardBody className="grid grid-cols-3 gap-x-6 gap-y-4 text-[13px]">
        {items.map(([label, value]) => (
          <div key={label}>
            <div className="mb-0.5 text-xs text-navy-70">{label}</div>
            <div>{value ?? <span className="text-navy-45">—</span>}</div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
