"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { Employee } from "@/db/schema";
import { deleteEmployeePermanently, setEmployeeStatus } from "@/lib/actions/employees";

export function StatusActions({ employee, deletable }: { employee: Employee; deletable: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      {employee.status === "active" && (
        <Button variant="outline" disabled title="Exit flow with final settlement arrives with payroll (Phase 4)">
          Mark as exited
        </Button>
      )}
      {employee.status === "exited" && (
        <Button variant="outline" disabled={pending} onClick={() => start(() => setEmployeeStatus(employee.id, "archived"))}>
          Archive
        </Button>
      )}
      {employee.status === "archived" && (
        <Button variant="outline" disabled={pending} onClick={() => start(() => setEmployeeStatus(employee.id, "active"))}>
          Unarchive
        </Button>
      )}
      {deletable && (
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() => {
            if (confirm(`Permanently delete ${employee.name}? This employee has no attendance, payslips or advances.`)) {
              start(() => deleteEmployeePermanently(employee.id));
            }
          }}
        >
          Delete permanently
        </Button>
      )}
    </div>
  );
}
