"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { checkIn, checkOut, lookupPin, manualTime, type CheckinResult } from "@/lib/actions/checkin";
import { cn } from "@/lib/utils";

type Props = { slug: string; companyName: string; enabled: boolean; shift: string };
type Ok = Extract<CheckinResult, { ok: true }>;

export function CheckinClient({ slug, companyName, enabled, shift }: Props) {
  const [pin, setPin] = useState("");
  const [session, setSession] = useState<Ok | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manual, setManual] = useState<"in" | "out" | null>(null);
  const [pending, start] = useTransition();

  const apply = (r: CheckinResult) => {
    if (r.ok) {
      setSession(r);
      setError(null);
      setNotice(r.message ?? null);
      setManual(null);
    } else {
      setError(r.error);
      if (r.locked) setPin("");
    }
  };

  useEffect(() => {
    if (pin.length === 4 && !session) {
      start(async () => {
        const r = await lookupPin(slug, pin);
        if (!r.ok) setPin("");
        apply(r);
      });
    }
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
    return (
      <Card>
        {Header}
        <h1 className="mb-4 mt-1 text-lg font-semibold">Enter your PIN</h1>
        <div className="mb-6 flex justify-center gap-3.5">
          {[0, 1, 2, 3].map((i) => (
            <i key={i} className={cn("block size-3.5 rounded-full border-2 border-navy", i < pin.length && "bg-navy")} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => key(k)}
              disabled={pending}
              className={cn(
                "h-[62px] rounded-[14px] bg-chalk text-[22px] font-medium text-navy active:bg-soft disabled:opacity-60",
                (k === "C" || k === "⌫") && "text-[13px] text-navy-70",
              )}
            >
              {k === "C" ? "Clear" : k}
            </button>
          ))}
        </div>
        <div className={cn("mt-4 min-h-5 text-sm", error ? "text-red" : "text-navy-45")}>
          {error ?? (pending ? "Checking…" : `Shift ${shift}`)}
        </div>
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
          pending={pending}
          onCancel={() => setManual(null)}
          onSubmit={(time, ampm) => start(async () => apply(await manualTime(slug, pin, manual, time, ampm)))}
        />
      ) : done ? (
        <div className="rounded-[14px] bg-chalk py-5 text-lg font-medium">Done for today</div>
      ) : !t.checkIn ? (
        <Button className="h-16 w-full rounded-[14px] text-[17px]" disabled={pending} onClick={() => start(async () => apply(await checkIn(slug, pin)))}>
          Check in now
        </Button>
      ) : (
        <Button variant="secondary" className="h-16 w-full rounded-[14px] text-[17px]" disabled={pending} onClick={() => start(async () => apply(await checkOut(slug, pin)))}>
          Check out now
        </Button>
      )}

      {!manual && !done && (
        <button type="button" className="mt-4 block w-full text-sm text-navy-70 underline underline-offset-4" onClick={() => setManual(t.checkIn ? "out" : "in")}>
          Forgot earlier? Enter the time yourself
        </button>
      )}
      <button type="button" className="mt-4 block w-full text-sm text-navy-45" onClick={reset}>
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
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(time, ampm);
      }}
      className="text-left"
    >
      <label className="mb-1 block text-xs text-navy-70">{kind === "in" ? "Check-in" : "Check-out"} time</label>
      <div className="mb-3 grid grid-cols-[2fr_1fr] gap-2">
        <input
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder={kind === "in" ? "8:04" : "4:58"}
          inputMode="numeric"
          autoFocus
          className="h-12 rounded-lg border border-soft bg-white px-3 text-center text-lg outline-none focus:border-amber"
        />
        <select value={ampm} onChange={(e) => setAmpm(e.target.value as "AM" | "PM")} className="h-12 rounded-lg border border-soft bg-white px-2 text-lg">
          <option>AM</option>
          <option>PM</option>
        </select>
      </div>
      <Button type="submit" variant="secondary" className="h-12 w-full rounded-[12px] text-base" disabled={pending || !time}>
        Save {kind === "in" ? "check-in" : "check-out"}
      </Button>
      <button type="button" className="mt-3 block w-full text-center text-sm text-navy-45" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl bg-white px-6 py-7 text-center shadow-card">{children}</div>;
}
