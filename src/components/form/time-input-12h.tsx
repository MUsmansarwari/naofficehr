"use client";

import { useState } from "react";
import { NativeSelect } from "./field";

/** 12-hour picker that submits a single 'HH:mm' (24h) value under `name`. */
export function TimeInput12h({ name, defaultValue = "09:00" }: { name: string; defaultValue?: string }) {
  const [h24, m] = defaultValue.split(":").map(Number);
  const [hour, setHour] = useState(h24 % 12 === 0 ? 12 : h24 % 12);
  const [minute, setMinute] = useState(m);
  const [ampm, setAmpm] = useState<"AM" | "PM">(h24 >= 12 ? "PM" : "AM");

  const value = `${String((hour % 12) + (ampm === "PM" ? 12 : 0)).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-1.5">
      <input type="hidden" name={name} value={value} />
      <NativeSelect value={hour} onChange={(e) => setHour(Number(e.target.value))} className="w-16" aria-label="Hour">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </NativeSelect>
      <span className="text-navy-45">:</span>
      <NativeSelect value={minute} onChange={(e) => setMinute(Number(e.target.value))} className="w-16" aria-label="Minute">
        {[0, 15, 30, 45].map((mm) => (
          <option key={mm} value={mm}>
            {String(mm).padStart(2, "0")}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect value={ampm} onChange={(e) => setAmpm(e.target.value as "AM" | "PM")} className="w-18" aria-label="AM/PM">
        <option>AM</option>
        <option>PM</option>
      </NativeSelect>
    </div>
  );
}
