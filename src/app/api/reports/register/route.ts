import { NextResponse, type NextRequest } from "next/server";
import { getActiveCompany } from "@/lib/company";
import { toRupees } from "@/lib/money";
import { attendanceSummary, salaryRegister, toCsv } from "@/lib/reports";

/**
 * CSV export for the reports page. Auth is enforced by the middleware, which
 * only lets /login and /checkin/* through unauthenticated.
 */
export async function GET(req: NextRequest) {
  const company = await getActiveCompany();
  if (!company) return new NextResponse("No company", { status: 400 });

  const ym = req.nextUrl.searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(ym)) return new NextResponse("Bad month", { status: 400 });
  const kind = req.nextUrl.searchParams.get("kind") === "attendance" ? "attendance" : "register";

  let csv: string;
  if (kind === "attendance") {
    const rows = await attendanceSummary(company, ym);
    csv = toCsv(
      ["code", "name", "present", "weekly_off", "public_holiday", "leave_paid", "leave_unpaid", "absent", "not_marked_yet", "hand_typed_times", "missing_check_outs"],
      rows.map((r) => [r.code, r.name, r.present, r.weeklyOff, r.publicHoliday, r.leavePaid, r.leaveUnpaid, r.absent, r.notMarked, r.byHand, r.missingCheckOut]),
    );
  } else {
    const rows = await salaryRegister(company.id, ym);
    // Amounts export as plain rupees so a spreadsheet can total them.
    csv = toCsv(
      [
        "code",
        "name",
        "designation",
        "monthly_salary",
        "payable_days",
        "unpaid_days",
        "base",
        "deduction",
        "advance",
        "additions",
        "deductions",
        "net_payable",
        "bank_name",
        "account_number",
      ],
      rows.map((r) => [
        r.code,
        r.name,
        r.designation,
        toRupees(r.monthlySalary),
        r.payableDays,
        r.unpaidDays,
        toRupees(r.baseAmount),
        toRupees(r.deductionAmount),
        toRupees(r.advanceDeduction),
        toRupees(r.otherAdditions),
        toRupees(r.otherDeductions),
        toRupees(r.netPayable),
        r.bankName,
        r.accountNumber,
      ]),
    );
  }

  const name = `${company.slug}-${kind === "attendance" ? "attendance" : "salary-register"}-${ym}.csv`;
  return new NextResponse(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
