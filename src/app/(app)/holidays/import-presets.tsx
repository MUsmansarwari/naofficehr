"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/skeleton";
import { importPreset } from "@/lib/actions/holidays";
import { PRESETS, type PresetKey } from "@/lib/holidays/presets";

export function ImportPresets({ year }: { year: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (key: PresetKey) =>
    start(async () => {
      const r = await importPreset(key, year);
      setMsg(`${PRESETS[key].label} ${year}: ${r.added} added${r.skipped ? `, ${r.skipped} already there` : ""}`);
    });
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-navy-70">{msg}</span>}
      {(Object.keys(PRESETS) as PresetKey[]).map((k) => (
        <Button key={k} variant="outline" className="border-0 bg-white shadow-card" disabled={pending} onClick={() => run(k)}>
          {pending && <Spinner />}
          Import {PRESETS[k].label} {year}
        </Button>
      ))}
    </div>
  );
}
