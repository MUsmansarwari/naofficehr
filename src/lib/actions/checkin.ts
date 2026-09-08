"use server";

import { createHash } from "node:crypto";
import { and, count, eq, gte } from "drizzle-orm";
import { headers } from "next/headers";
import { db, schema } from "@/db";
import type { Company } from "@/db/schema";
import { instantOnShiftDate, to24h, validateManualTime } from "@/lib/attendance/time";
import { formatLocal, shiftDate } from "@/lib/dates";

// Brute-force limits (build-spec §4): per-IP 10 fails / 10 min → 15 min block;
// per-company 100 fails / hour → page off for an hour.
const IP_FAILS = 10;
const IP_WINDOW_MIN = 10;
const IP_BLOCK_MIN = 15;
const COMPANY_FAILS = 100;
const COMPANY_WINDOW_MIN = 60;

export type TodayState = {
  shiftDate: string;
  shiftLabel: string;
  checkIn: string | null; // '8:04 PM'
  checkOut: string | null;
  byHand: boolean;
};

export type CheckinResult =
  | { ok: true; employee: { name: string }; today: TodayState; message?: string }
  | { ok: false; error: string; locked?: boolean };

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
}

const hashPin = (pin: string) => createHash("sha256").update(pin).digest("hex");

async function failuresSince(where: ReturnType<typeof and>, minutesAgo: number) {
  const since = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  const [r] = await db
    .select({ n: count() })
    .from(schema.checkinAttempts)
    .where(and(where, eq(schema.checkinAttempts.success, false), gte(schema.checkinAttempts.at, since)));
  return r?.n ?? 0;
}

async function isBlocked(companyId: number, ip: string) {
  const ipFails = await failuresSince(and(eq(schema.checkinAttempts.companyId, companyId), eq(schema.checkinAttempts.ip, ip)), IP_BLOCK_MIN);
  if (ipFails >= IP_FAILS) return "Too many attempts — try again in 15 minutes";
  const recentIp = await failuresSince(and(eq(schema.checkinAttempts.companyId, companyId), eq(schema.checkinAttempts.ip, ip)), IP_WINDOW_MIN);
  if (recentIp >= IP_FAILS) return "Too many attempts — try again in 15 minutes";
  const companyFails = await failuresSince(eq(schema.checkinAttempts.companyId, companyId), COMPANY_WINDOW_MIN);
  if (companyFails >= COMPANY_FAILS) return "Check-in is paused for an hour — tell your manager";
  return null;
}

type Resolved =
  | { ok: false; error: string; locked?: boolean }
  | { ok: true; company: Company; employee: schema.Employee; now: Date; today: string };

async function resolve(slug: string, pin: string): Promise<Resolved> {
  const [company] = await db.select().from(schema.companies).where(eq(schema.companies.slug, slug)).limit(1);
  if (!company) return { ok: false, error: "Unknown company" };
  if (!company.checkinEnabled) return { ok: false, error: "Check-in is turned off for this company" };

  const ip = await clientIp();
  const blocked = await isBlocked(company.id, ip);
  if (blocked) return { ok: false, error: blocked, locked: true };

  if (!/^\d{4}$/.test(pin)) return { ok: false, error: "PIN must be 4 digits" };
  const [employee] = await db
    .select()
    .from(schema.employees)
    .where(and(eq(schema.employees.companyId, company.id), eq(schema.employees.checkinPin, pin), eq(schema.employees.status, "active")))
    .limit(1);

  const now = new Date();
  const today = shiftDate(now, company);
  const valid = !!employee && employee.joinDate <= today;

  await db.insert(schema.checkinAttempts).values({
    companyId: company.id,
    ip,
    pinHash: hashPin(pin),
    success: valid,
    employeeId: valid ? employee.id : null,
  });
  if (!valid || !employee) return { ok: false, error: "Wrong PIN" };
  return { ok: true, company, employee, now, today };
}

async function todayState(company: Company, employeeId: number, today: string): Promise<TodayState> {
  const [row] = await db
    .select()
    .from(schema.attendance)
    .where(and(eq(schema.attendance.employeeId, employeeId), eq(schema.attendance.date, today)))
    .limit(1);
  const tz = company.timezone;
  return {
    shiftDate: today,
    shiftLabel: formatLocal(`${today}T12:00:00`, "UTC", "EEEE, MMM d"),
    checkIn: row?.checkInAt ? formatLocal(row.checkInAt, tz) : null,
    checkOut: row?.checkOutAt ? formatLocal(row.checkOutAt, tz) : null,
    byHand: row?.timeEnteredByHand ?? false,
  };
}

export async function lookupPin(slug: string, pin: string): Promise<CheckinResult> {
  const r = await resolve(slug, pin);
  if (!r.ok) return { ok: false, error: r.error, locked: r.locked };
  return { ok: true, employee: { name: r.employee.name }, today: await todayState(r.company, r.employee.id, r.today) };
}

type Upsert = { checkInAt?: string; checkOutAt?: string; byHand?: boolean };

async function upsertToday(employeeId: number, today: string, patch: Upsert) {
  const [existing] = await db
    .select()
    .from(schema.attendance)
    .where(and(eq(schema.attendance.employeeId, employeeId), eq(schema.attendance.date, today)))
    .limit(1);
  const nowIso = new Date().toISOString();
  if (existing) {
    await db
      .update(schema.attendance)
      .set({
        checkInAt: patch.checkInAt ?? existing.checkInAt,
        checkOutAt: patch.checkOutAt ?? existing.checkOutAt,
        timeEnteredByHand: existing.timeEnteredByHand || !!patch.byHand,
        // manager override keeps its status; otherwise a check-in means present
        status: existing.isOverride ? existing.status : "present",
        updatedAt: nowIso,
      })
      .where(eq(schema.attendance.id, existing.id));
    return existing;
  }
  await db.insert(schema.attendance).values({
    employeeId,
    date: today,
    status: "present",
    source: "checkin",
    checkInAt: patch.checkInAt ?? null,
    checkOutAt: patch.checkOutAt ?? null,
    timeEnteredByHand: !!patch.byHand,
    updatedAt: nowIso,
  });
  return null;
}

export async function checkIn(slug: string, pin: string): Promise<CheckinResult> {
  const r = await resolve(slug, pin);
  if (!r.ok) return { ok: false, error: r.error, locked: r.locked };
  const state = await todayState(r.company, r.employee.id, r.today);
  if (state.checkIn) return { ok: false, error: `Already checked in at ${state.checkIn}` };
  await upsertToday(r.employee.id, r.today, { checkInAt: r.now.toISOString() });
  return { ok: true, employee: { name: r.employee.name }, today: await todayState(r.company, r.employee.id, r.today), message: "Checked in" };
}

export async function checkOut(slug: string, pin: string): Promise<CheckinResult> {
  const r = await resolve(slug, pin);
  if (!r.ok) return { ok: false, error: r.error, locked: r.locked };
  const state = await todayState(r.company, r.employee.id, r.today);
  if (!state.checkIn) return { ok: false, error: "Check in first" };
  if (state.checkOut) return { ok: false, error: `Already checked out at ${state.checkOut}` };
  await upsertToday(r.employee.id, r.today, { checkOutAt: r.now.toISOString() });
  return { ok: true, employee: { name: r.employee.name }, today: await todayState(r.company, r.employee.id, r.today), message: "Checked out" };
}

export async function manualTime(
  slug: string,
  pin: string,
  kind: "in" | "out",
  time: string,
  ampm: "AM" | "PM",
): Promise<CheckinResult> {
  const r = await resolve(slug, pin);
  if (!r.ok) return { ok: false, error: r.error, locked: r.locked };

  let hhmm: string;
  try {
    hhmm = to24h(time, ampm);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid time" };
  }
  const at = instantOnShiftDate(r.today, hhmm, r.company);

  const [row] = await db
    .select()
    .from(schema.attendance)
    .where(and(eq(schema.attendance.employeeId, r.employee.id), eq(schema.attendance.date, r.today)))
    .limit(1);
  if (kind === "in" && row?.checkInAt) return { ok: false, error: "Check-in time already recorded" };
  if (kind === "out" && row?.checkOutAt) return { ok: false, error: "Check-out time already recorded" };
  if (kind === "out" && !row?.checkInAt) return { ok: false, error: "Enter the check-in time first" };

  const err = validateManualTime({
    kind,
    at,
    shiftDate: r.today,
    company: r.company,
    now: r.now,
    checkInAt: row?.checkInAt ? new Date(row.checkInAt) : null,
    checkOutAt: row?.checkOutAt ? new Date(row.checkOutAt) : null,
  });
  if (err) return { ok: false, error: err };

  await upsertToday(r.employee.id, r.today, kind === "in" ? { checkInAt: at.toISOString(), byHand: true } : { checkOutAt: at.toISOString(), byHand: true });
  return {
    ok: true,
    employee: { name: r.employee.name },
    today: await todayState(r.company, r.employee.id, r.today),
    message: kind === "in" ? "Check-in time saved" : "Check-out time saved",
  };
}
