import { CardSkeleton, HeaderSkeleton, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <CardSkeleton>
          <div className="flex items-center justify-between border-b border-navy-06 px-5 py-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-9 w-28 rounded-[10px]" />
          </div>
          <div className="space-y-6 px-5 py-5">
            {[2, 2, 3].map((cols, s) => (
              <div key={s} className={cols === 3 ? "grid grid-cols-3 gap-4" : "grid grid-cols-2 gap-4"}>
                {Array.from({ length: cols * 2 }, (_, i) => (
                  <div key={i}>
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="mt-2 h-9 rounded-[10px]" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardSkeleton>
        <div className="grid content-start gap-4">
          {[3, 4].map((rows, i) => (
            <CardSkeleton key={i}>
              <div className="border-b border-navy-06 px-5 py-4">
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="space-y-3.5 px-5 py-5">
                {Array.from({ length: rows }, (_, r) => (
                  <Skeleton key={r} className="h-3.5" />
                ))}
              </div>
            </CardSkeleton>
          ))}
        </div>
      </div>
    </>
  );
}
