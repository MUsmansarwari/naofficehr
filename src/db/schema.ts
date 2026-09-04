import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Conventions (build-spec §2):
//  - money is integer paisa, never float
//  - dates are 'YYYY-MM-DD' strings, months are 'YYYY-MM', timestamps are ISO UTC strings
//  - nothing is hard-deleted except an employee with zero records (§9)

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  schemaVersion: integer("schema_version").notNull().default(1),
  lastBackupAt: text("last_backup_at"),
  updatedAt: text("updated_at").notNull().default(now),
});

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").notNull().default("Asia/Karachi"),
  currency: text("currency").notNull().default("PKR"),
  salaryDivisor: integer("salary_divisor").notNull().default(30),
  shiftStart: text("shift_start").notNull().default("20:00"),
  shiftEnd: text("shift_end").notNull().default("05:00"),
  weeklyOffs: text("weekly_offs", { mode: "json" })
    .$type<number[]>()
    .notNull()
    .default(sql`'[0,6]'`),
  defaultProbationMonths: integer("default_probation_months").notNull().default(3),
  defaultLeaveQuota: integer("default_leave_quota").notNull().default(8),
  deductPublicHolidaysInProbation: integer("deduct_public_holidays_in_probation", {
    mode: "boolean",
  })
    .notNull()
    .default(false),
  checkinEnabled: integer("checkin_enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(now),
});

export const employees = sqliteTable(
  "employees",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    cnic: text("cnic"),
    designation: text("designation"),
    joinDate: text("join_date").notNull(),
    exitDate: text("exit_date"),
    exitType: text("exit_type", {
      enum: ["resigned", "terminated", "contract_ended", "probation_failed"],
    }),
    probationMonths: integer("probation_months").notNull().default(3),
    probationEndDate: text("probation_end_date").notNull(),
    employmentStage: text("employment_stage", { enum: ["probation", "confirmed"] })
      .notNull()
      .default("probation"),
    status: text("status", { enum: ["active", "exited", "archived"] })
      .notNull()
      .default("active"),
    leaveQuotaAnnual: integer("leave_quota_annual"),
    checkinPin: text("checkin_pin"),
    bankName: text("bank_name"),
    accountNumber: text("account_number"),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("employees_company_code").on(t.companyId, t.code),
    uniqueIndex("employees_company_pin").on(t.companyId, t.checkinPin),
  ],
);

export const salaryStructures = sqliteTable(
  "salary_structures",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),
    monthlySalary: integer("monthly_salary").notNull(), // paisa
    effectiveFrom: text("effective_from").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("salary_employee_effective").on(t.employeeId, t.effectiveFrom)],
);

export const holidays = sqliteTable(
  "holidays",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id),
    date: text("date").notNull(),
    name: text("name").notNull(),
    source: text("source", { enum: ["us_federal", "pakistan", "custom"] })
      .notNull()
      .default("custom"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [uniqueIndex("holidays_company_date").on(t.companyId, t.date)],
);

export const attendanceStatuses = [
  "present",
  "absent",
  "leave_paid",
  "leave_unpaid",
  "weekly_off",
  "public_holiday",
] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];

export const attendance = sqliteTable(
  "attendance",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),
    date: text("date").notNull(), // SHIFT date, not calendar date (§4)
    status: text("status", { enum: attendanceStatuses }).notNull(),
    checkInAt: text("check_in_at"),
    checkOutAt: text("check_out_at"),
    source: text("source", { enum: ["checkin", "manual"] }).notNull(),
    isOverride: integer("is_override", { mode: "boolean" }).notNull().default(false),
    timeEnteredByHand: integer("time_entered_by_hand", { mode: "boolean" })
      .notNull()
      .default(false),
    note: text("note"),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [uniqueIndex("attendance_employee_date").on(t.employeeId, t.date)],
);

export const advances = sqliteTable("advances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  amount: integer("amount").notNull(),
  reason: text("reason"),
  givenOn: text("given_on").notNull(),
  installmentAmount: integer("installment_amount").notNull(),
  remainingAmount: integer("remaining_amount").notNull(),
  startMonth: text("start_month").notNull(), // 'YYYY-MM'
  status: text("status", { enum: ["active", "paused", "closed"] })
    .notNull()
    .default("active"),
  note: text("note"),
  createdAt: text("created_at").notNull().default(now),
});

export const payrollRuns = sqliteTable(
  "payroll_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id),
    year: integer("year").notNull(),
    month: integer("month").notNull(), // 1–12
    status: text("status", { enum: ["draft", "locked"] }).notNull().default("draft"),
    divisorUsed: integer("divisor_used").notNull(),
    generatedAt: text("generated_at").notNull().default(now),
    lockedAt: text("locked_at"),
    unlockedAt: text("unlocked_at"),
    unlockReason: text("unlock_reason"),
  },
  (t) => [uniqueIndex("payroll_runs_company_month").on(t.companyId, t.year, t.month)],
);

export const advanceInstallments = sqliteTable("advance_installments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  advanceId: integer("advance_id")
    .notNull()
    .references(() => advances.id),
  payrollRunId: integer("payroll_run_id")
    .notNull()
    .references(() => payrollRuns.id),
  month: text("month").notNull(), // 'YYYY-MM'
  amount: integer("amount").notNull(),
  createdAt: text("created_at").notNull().default(now),
});

export const payslips = sqliteTable(
  "payslips",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    payrollRunId: integer("payroll_run_id")
      .notNull()
      .references(() => payrollRuns.id),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),
    // everything below is a SNAPSHOT — never recomputed after lock (§2)
    monthlySalary: integer("monthly_salary").notNull(),
    perDayRate: integer("per_day_rate").notNull(),
    divisor: integer("divisor").notNull(),
    presentDays: integer("present_days").notNull(),
    weeklyOffDays: integer("weekly_off_days").notNull(),
    publicHolidayDays: integer("public_holiday_days").notNull(),
    leavePaidDays: integer("leave_paid_days").notNull(),
    leaveUnpaidDays: integer("leave_unpaid_days").notNull(),
    absentDays: integer("absent_days").notNull(),
    payableDays: integer("payable_days").notNull(),
    unpaidDays: integer("unpaid_days").notNull(),
    baseAmount: integer("base_amount").notNull(),
    deductionAmount: integer("deduction_amount").notNull(),
    advanceDeduction: integer("advance_deduction").notNull().default(0),
    otherAdditions: integer("other_additions").notNull().default(0),
    otherAdditionsNote: text("other_additions_note"),
    otherDeductions: integer("other_deductions").notNull().default(0),
    otherDeductionsNote: text("other_deductions_note"),
    netPayable: integer("net_payable").notNull(),
    wasOnProbation: integer("was_on_probation", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [uniqueIndex("payslips_run_employee").on(t.payrollRunId, t.employeeId)],
);

export const checkinAttempts = sqliteTable("checkin_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id),
  ip: text("ip").notNull(),
  pinHash: text("pin_hash").notNull(),
  success: integer("success", { mode: "boolean" }).notNull(),
  employeeId: integer("employee_id").references(() => employees.id),
  at: text("at").notNull().default(now),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entityType: text("entity_type", {
    enum: ["attendance", "employee", "salary_structure", "advance", "payroll_run", "holiday", "company"],
  }).notNull(),
  entityId: integer("entity_id").notNull(),
  action: text("action", {
    enum: ["create", "update", "delete", "lock", "unlock", "override"],
  }).notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  note: text("note"),
  at: text("at").notNull().default(now),
});

export type Company = typeof companies.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type SalaryStructure = typeof salaryStructures.$inferSelect;
export type Holiday = typeof holidays.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type Advance = typeof advances.$inferSelect;
export type PayrollRun = typeof payrollRuns.$inferSelect;
export type Payslip = typeof payslips.$inferSelect;
