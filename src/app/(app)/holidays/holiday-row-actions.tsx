"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Holiday } from "@/db/schema";
import { renameHoliday, setHolidayActive } from "@/lib/actions/holidays";

export function HolidayRowActions({ holiday }: { holiday: Holiday }) {
  const [pending, start] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(holiday.name);

  if (renaming) {
    return (
      <form
        className="flex items-center justify-end gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            await renameHoliday(holiday.id, name);
            setRenaming(false);
          });
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-48" autoFocus />
        <Button type="submit" size="sm" disabled={pending}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(false)}>
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {holiday.isActive ? (
        <>
          <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}>
            Rename
          </Button>
          <Button size="sm" variant="ghost" className="text-red" disabled={pending} onClick={() => start(() => setHolidayActive(holiday.id, false))}>
            Remove
          </Button>
        </>
      ) : (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => setHolidayActive(holiday.id, true))}>
          Restore
        </Button>
      )}
    </div>
  );
}
