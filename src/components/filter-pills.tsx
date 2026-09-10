import { PendingLink } from "@/components/pending-link";
import { cn } from "@/lib/utils";

export type Pill = { key: string; label: string; href: string };

export function FilterPills({ items, current, className }: { items: Pill[]; current: string; className?: string }) {
  return (
    <div className={cn("mb-4 inline-flex gap-0.5 rounded-full bg-white p-1 shadow-card", className)}>
      {items.map((i) => (
        <PendingLink
          key={i.key}
          href={i.href}
          className={cn(
            "rounded-full px-4 py-1.5 text-[13px] font-medium text-navy-70 transition-colors",
            i.key === current && "bg-navy text-chalk",
          )}
        >
          {i.label}
        </PendingLink>
      ))}
    </div>
  );
}
