import { CardSkeleton, HeaderSkeleton, Skeleton, StatSkeleton, TableSkeleton } from "@/components/skeleton";

/** Dashboard placeholder — also the fallback for any segment without its own. */
export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="mb-4 grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <StatSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <CardSkeleton>
          <div className="flex items-center justify-between border-b border-navy-06 px-5 py-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-40" />
          </div>
          <TableSkeleton rows={4} cols={4} />
        </CardSkeleton>
        <div className="grid content-start gap-4">
          {[3, 3, 2].map((rows, i) => (
            <CardSkeleton key={i}>
              <div className="border-b border-navy-06 px-5 py-4">
                <Skeleton className="h-4 w-36" />
              </div>
              <div className="space-y-3 px-5 py-5">
                {Array.from({ length: rows }, (_, r) => (
                  <div key={r} className="flex justify-between gap-4">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3.5 w-10" />
                  </div>
                ))}
              </div>
            </CardSkeleton>
          ))}
        </div>
      </div>
    </>
  );
}
