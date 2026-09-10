import { HeaderSkeleton, Skeleton } from "@/components/skeleton";

/** The grid is the slow one — mirror its shape so nothing jumps when it lands. */
export default function Loading() {
  return (
    <>
      <HeaderSkeleton actions={4} />
      <div className="mb-3 flex flex-wrap items-center gap-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-3.5 w-24" />
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="flex items-center gap-3 border-b border-navy-06 px-4 py-3.5">
          <Skeleton className="h-3 w-44 shrink-0" />
          {Array.from({ length: 22 }, (_, i) => (
            <Skeleton key={i} className="h-3 w-4 shrink-0" />
          ))}
        </div>
        {Array.from({ length: 6 }, (_, r) => (
          <div
            key={r}
            className="flex items-center gap-3 border-b border-navy-06 px-4 py-3.5 last:border-0"
            style={{ opacity: 1 - r * 0.1 }}
          >
            <div className="w-44 shrink-0">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="mt-1.5 h-2.5 w-14" />
            </div>
            {Array.from({ length: 22 }, (_, c) => (
              <Skeleton key={c} className="h-5 w-4 shrink-0" />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
