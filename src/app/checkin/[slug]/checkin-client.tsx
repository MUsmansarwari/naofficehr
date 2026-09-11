"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/skeleton";
import { checkIn, checkOut, lookupPin, manualTime, type CheckinResult } from "@/lib/actions/checkin";
import { looseTimePreview } from "@/lib/attendance/time";
import { cn } from "@/lib/utils";

type Props = { slug: string; companyName: string; enabled: boolean; shift: string };
type Ok = Extract<CheckinResult, { ok: true }>;
type Busy = "lookup" | "in" | "out" | "manual" | null;

export function CheckinClient({ slug, companyName, enabled, shift }: Props) {
  const [pin, setPin] = useState("");
  const [session, setSession] = useState<Ok | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manual, setManual] = useState<"in" | "out" | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [pending, start] = useTransition();

  const run = (what: Exclude<Busy, null>, fn: () => Promise<CheckinResult>) => {
    setBusy(what);
    setError(null);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          setSession(r);
          setNotice(r.message ?? null);
          setManual(null);
        } else {
          setError(r.error);
          if (what === "lookup" || r.locked) setPin("");
        }
      } catch {
        setError("Could not reach the server — check your connection and try again");
        if (what === "lookup") setPin("");
      } finally {
        setBusy(null);
      }
    });
  };

  useEffect(() => {
    if (pin.length === 4 && !session) run("lookup", () => lookupPin(slug, pin));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const reset = () => {
    setPin("");
    setSession(null);
    setError(null);
    setNotice(null);
    setManual(null);
  };

  const key = (k: string) => {
    if (pending) return;
    setError(null);
    if (k === "C") setPin("");
    else if (k === "⌫") setPin((p) => p.slice(0, -1));
    else setPin((p) => (p.length < 4 ? p + k : p));
  };

  const Header = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/icon.svg" alt="" width={40} height={40} className="mx-auto mb-3" />
      <div className="text-xs uppercase tracking-[0.08em] text-navy-45">{companyName}</div>
    </>
  );

  if (!enabled) {
    return (
      <Card>
        {Header}
        <p className="mt-4 text-navy-70">Check-in is turned off for this company.</p>
      </Card>
    );
  }

  if (!session) {
    const checking = busy === "lookup";
    return (
      <Card>
        {Header}
        <h1 className="mb-4 mt-1 text-lg font-semibold">Enter your PIN</h1>

        {/* The dots become the loader — it sits exactly where the eye already is. */}
        <div className="mb-6 flex h-5 items-center justify-center gap-3.5">
          {checking ? (
            <span className="inline-flex items-center gap-2 text-sm font-medium text-amber">
              <Spinner className="size-4" /> Checking PIN…
            </span>
          ) : (
            [0, 1, 2, 3].map((i) => (
              <i key={i} className={cn("block size-3.5 rounded-full border-2 border-navy transition-colors", i < pin.length && "bg-navy")} />
            ))
          )}
        </div>

        <div className={cn("grid grid-cols-3 gap-2.5 transition-opacity", checking && "pointer-events-none opacity-40")}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => key(k)}
              disabled={pending}
              className={cn(
                "h-[62px] rounded-[14px] bg-chalk text-[22px] font-medium text-navy active:bg-soft",
                (k === "C" || k === "⌫") && "text-[13px] text-navy-70",
              )}
            >
              {k === "C" ? "Clear" : k}
            </button>
          ))}
        </div>
        <div className={cn("mt-4 min-h-5 text-sm", error ? "text-red" : "text-navy-45")}>{error ?? `Shift ${shift}`}</div>
      </Card>
    );
  }

  const t = session.today;
  const done = !!t.checkIn && !!t.checkOut;

  return (
    <Card>
      {Header}
      <div className="mt-1 text-[22px] font-semibold">{session.employee.name}</div>
      <div className="mb-5 text-navy-70">
        {t.shiftLabel} shift
        {t.checkIn && (
          <>
            {" "}
            · in {t.checkIn}
            {t.byHand && <span className="ml-1 inline-block size-1.5 rounded-full bg-amber align-middle" title="typed by hand" />}
          </>
        )}
        {t.checkOut && <> · out {t.checkOut}</>}
      </div>

      {notice && <div className="mb-3 rounded-lg bg-amber-12 px-3 py-2 text-sm">{notice}</div>}
      {error && <div className="mb-3 rounded-lg bg-red-12 px-3 py-2 text-sm text-red">{error}</div>}

      {manual ? (
        <ManualForm
          kind={manual}
          pending={busy === "manual"}
          onCancel={() => setManual(null)}
          onSubmit={(time, ampm) => run("manual", () => manualTime(slug, pin, manual, time, ampm))}
        />
      ) : done ? (
        <div className="rounded-[14px] bg-chalk py-5 text-lg font-medium">Done for today</div>
      ) : !t.checkIn ? (
        <Button className="h-16 w-full rounded-[14px] text-[17px]" disabled={pending} onClick={() => run("in", () => checkIn(slug, pin))}>
          {busy === "in" ? (
            <>
              <Spinner className="size-5" /> Checking in…
            </>
          ) : (
            "Check in now"
          )}
        </Button>
      ) : (
        <Button variant="secondary" className="h-16 w-full rounded-[14px] text-[17px]" disabled={pending} onClick={() => run("out", () => checkOut(slug, pin))}>
          {busy === "out" ? (
            <>
              <Spinner className="size-5" /> Checking out…
            </>
          ) : (
            "Check out now"
          )}
        </Button>
      )}

      {!manual && !done && (
        <button
          type="button"
          disabled={pending}
          className="mt-4 block w-full text-sm text-navy-70 underline underline-offset-4 disabled:opacity-50"
          onClick={() => setManual(t.checkIn ? "out" : "in")}
        >
          Forgot earlier? Enter the time yourself
        </button>
      )}
      <button type="button" disabled={pending} className="mt-4 block w-full text-sm text-navy-45 disabled:opacity-50" onClick={reset}>
        Start over
      </button>
    </Card>
  );
}

function ManualForm({
  kind,
  pending,
  onCancel,
  onSubmit,
}: {
  kind: "in" | "out";
  pending: boolean;
  onCancel: () => void;
  onSubmit: (time: string, ampm: "AM" | "PM") => void;
}) {
  const [time, setTime] = useState("");
  const [ampm, setAmpm] = useState<"AM" | "PM">(kind === "in" ? "PM" : "AM");
  const preview = looseTimePreview(time, ampm);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(time, ampm);
      }}
      className="text-left"
    >
      <label className="mb-1 block text-xs text-navy-70">{kind === "in" ? "Check-in" : "Check-out"} time</label>
      <div className="mb-1.5 grid grid-cols-[2fr_1fr] gap-2">
        <input
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder={kind === "in" ? "804 or 8.04" : "458 or 4.58"}
          inputMode="numeric"
          autoFocus
          disabled={pending}
          className="h-12 rounded-lg border border-soft bg-white px-3 text-center text-lg outline-none focus:border-amber disabled:opacity-60"
        />
        <select
          value={ampm}
          onChange={(e) => setAmpm(e.target.value as "AM" | "PM")}
          disabled={pending}
          className="h-12 rounded-lg border border-soft bg-white px-2 text-lg disabled:opacity-60"
        >
          <option>AM</option>
          <option>PM</option>
        </select>
      </div>
      {/* Live readback: type "804" and see "→ 8:04 PM" before saving. */}
      <div className={cn("mb-3 min-h-5 text-center text-sm", preview ? "text-navy" : "text-navy-45")}>
        {preview ? (
          <>
            Will save as <b className="font-semibold">{preview}</b>
          </>
        ) : time ? (
          "Type numbers only — 8, 804 or 8.04"
        ) : (
          "No colon needed — 804 works"
        )}
      </div>
      <Button type="submit" variant="secondary" className="h-12 w-full rounded-[12px] text-base" disabled={pending || !preview}>
        {pending ? (
          <>
            <Spinner /> Saving…
          </>
        ) : (
          `Save ${kind === "in" ? "check-in" : "check-out"}`
        )}
      </Button>
      <button type="button" disabled={pending} className="mt-3 block w-full text-center text-sm text-navy-45 disabled:opacity-50" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl bg-white px-6 py-7 text-center shadow-card">{children}</div>;
}
