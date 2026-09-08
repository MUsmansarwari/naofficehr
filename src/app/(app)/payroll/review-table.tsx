"use client";

import Link from "next/link";
import { useState } from "react";
import { Tag } from "@/components/tag";
import { Button } from "@/components/ui/button";
import type { Employee, Payslip } from "@/db/schema";
import { fmtMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { AdjustDialog } from "./adjust-dialog";

type Row = { payslip: Payslip; employee: Employee };
type Total = {
  base: number;
  deduction: number;
  advance: number;
  additions: number;
  deductions: number;
  net: number;
  payableDays: number;
  unpaidDays: number;
};

export function ReviewTable({ rows, locked, total }: { rows: Row[]; locked: boolean; total: Total }) {
  const [adjusting, setAdjusting] = useState<Row | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className="text-left text-xs text-navy-45">
              <Th className="pl-5">Employee</Th>
              <Th right>Salary</Th>
              <Th right>Payable days</Th>
              <Th right>Unpaid days</Th>
              <Th right>Base</Th>
              <Th right>Deduction</Th>
              <Th right>Advance</Th>
              <Th right>Additions</Th>
              <Th right>Deductions</Th>
              <Th right className="pr-5">
                Net payable
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-06">
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-5 py-8 text-center text-navy-45">
                  No payslips in this run.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const p = row.payslip;
              return (
                <tr key={p.id} className="hover:bg-chalk/50">
                  <td className="py-3 pl-5 pr-3">
                    <span className="font-medium">{row.employee.name}</span>
                    <span className="ml-2 text-xs text-navy-45">{row.employee.code}</span>
                    {p.wasOnProbation && (
                      <Tag variant="probation" className="ml-2">
                        Probation
                      </Tag>
                    )}
                    {p.payableDays < 28 && (
                      <Tag className="ml-2">{p.payableDays} days</Tag>
                    )}
                  </td>
                  <Td right>{fmtMoney(p.monthlySalary)}</Td>
                  <Td right>{p.payableDays}</Td>
                  <Td right className={p.unpaidDays > 0 ? "text-red" : "text-navy-45"}>
                    {p.unpaidDays}
                  </Td>
                  <Td right>{fmtMoney(p.baseAmount)}</Td>
                  <Td right className={p.deductionAmount > 0 ? "text-red" : "text-navy-45"}>
                    {fmtMoney(p.deductionAmount)}
                  </Td>
                  <Td right className={p.advanceDeduction > 0 ? "" : "text-navy-45"}>
                    {fmtMoney(p.advanceDeduction)}
                  </Td>
                  <Td right className={p.otherAdditions > 0 ? "" : "text-navy-45"} title={p.otherAdditionsNote ?? undefined}>
                    {fmtMoney(p.otherAdditions)}
                  </Td>
                  <Td right className={p.otherDeductions > 0 ? "" : "text-navy-45"} title={p.otherDeductionsNote ?? undefined}>
                    {fmtMoney(p.otherDeductions)}
                  </Td>
                  <td className="py-3 pl-3 pr-5 text-right">
                    <span className="font-semibold">{fmtMoney(p.netPayable)}</span>
                    {!locked && (
                      <Button variant="ghost" size="xs" className="ml-2" onClick={() => setAdjusting(row)}>
                        Adjust
                      </Button>
                    )}
                    <Link href={`/payslips/${p.id}`} className="ml-2 text-xs text-navy-45 hover:underline">
                      Payslip
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-navy-12 bg-chalk font-semibold">
                <td className="py-3 pl-5 pr-3">Total · {rows.length}</td>
                <Td right>—</Td>
                <Td right>{total.payableDays}</Td>
                <Td right className={total.unpaidDays > 0 ? "text-red" : ""}>
                  {total.unpaidDays}
                </Td>
                <Td right>{fmtMoney(total.base)}</Td>
                <Td right className={total.deduction > 0 ? "text-red" : ""}>
                  {fmtMoney(total.deduction)}
                </Td>
                <Td right>{fmtMoney(total.advance)}</Td>
                <Td right>{fmtMoney(total.additions)}</Td>
                <Td right>{fmtMoney(total.deductions)}</Td>
                <td className="py-3 pl-3 pr-5 text-right">{fmtMoney(total.net)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {adjusting && (
        <AdjustDialog
          key={adjusting.payslip.id}
          payslip={adjusting.payslip}
          employeeName={adjusting.employee.name}
          onClose={() => setAdjusting(null)}
        />
      )}
    </>
  );
}

function Th({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return <th className={cn("px-3 py-3 font-medium", right && "text-right", className)}>{children}</th>;
}

function Td({ children, right, className, title }: { children: React.ReactNode; right?: boolean; className?: string; title?: string }) {
  return (
    <td title={title} className={cn("px-3 py-3", right && "text-right", className)}>
      {children}
    </td>
  );
}
