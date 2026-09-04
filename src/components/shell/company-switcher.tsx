"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import type { Company } from "@/db/schema";
import { switchCompany } from "@/lib/actions/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CompanySwitcher({
  companies,
  activeId,
}: {
  companies: Company[];
  activeId: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const active = companies.find((c) => c.id === activeId);

  if (companies.length === 0) {
    return <div className="rounded-full bg-white px-4 py-2 font-medium shadow-card">No company yet</div>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="inline-flex items-center gap-2.5 rounded-full bg-white py-2 pl-4 pr-3.5 font-medium shadow-card outline-none focus-visible:ring-2 focus-visible:ring-amber"
      >
        {active?.name ?? "Select company"}
        <ChevronDown className="size-3.5 text-navy-45" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        {companies.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() =>
              start(async () => {
                await switchCompany(c.id);
                router.refresh();
              })
            }
            className={c.id === activeId ? "font-medium" : undefined}
          >
            {c.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
