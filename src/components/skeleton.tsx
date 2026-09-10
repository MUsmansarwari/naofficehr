import { cn } from "@/lib/utils";

/** A shimmering placeholder block. Sizing comes from the caller. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden className={cn("na-skeleton h-4 w-full", className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("size-3.5 shrink-0 animate-spin", className)} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity=".25" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Page title + subtitle placeholder, matching PageHeader's spacing. */
export function HeaderSkeleton({ actions = 1, back }: { actions?: number; back?: boolean }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {back && <Skeleton className="mb-2.5 h-3 w-24" />}
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2.5 h-4 w-80" />
      </div>
      <div className="flex items-center gap-2">
        {Array.from({ length: actions }, (_, i) => (
          <Skeleton key={i} className="h-9 w-32 rounded-[10px]" />
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={cn("rounded-2xl bg-white shadow-card", className)}>{children}</div>;
}

/** Table placeholder with a header row and `rows` body rows. */
export function TableSkeleton({
  rows = 5,
  cols = 5,
  firstWide = true,
  className,
}: {
  rows?: number;
  cols?: number;
  firstWide?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3 border-b border-navy-06 px-5 py-3.5">
        {Array.from({ length: cols }, (_, c) => (
          <Skeleton key={c} className={cn("h-3", firstWide && c === 0 ? "w-40" : "w-16 last:ml-auto")} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-3 border-b border-navy-06 px-5 py-4 last:border-0">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton
              key={c}
              className={cn("h-3.5", firstWide && c === 0 ? "w-44" : "w-14 last:ml-auto")}
              style={{ opacity: 1 - r * 0.12 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatSkeleton() {
  return (
    <CardSkeleton className="px-5 py-5">
      <Skeleton className="h-3.5 w-28" />
      <Skeleton className="mt-3.5 h-8 w-20" />
      <Skeleton className="mt-3 h-3 w-24" />
    </CardSkeleton>
  );
}

/** Rounded pill row — filter tabs, month pickers. */
export function PillsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("mb-4 inline-flex gap-2 rounded-full bg-white p-1 shadow-card", className)}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-7 w-20 rounded-full" />
      ))}
    </div>
  );
}
