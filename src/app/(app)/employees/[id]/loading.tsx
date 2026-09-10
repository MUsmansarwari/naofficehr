import { CardSkeleton, HeaderSkeleton, Skeleton, TableSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton actions={2} back />
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <div className="grid content-start gap-4">
          <CardSkeleton>
            <div className="flex items-center justify-between border-b border-navy-06 px-5 py-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-28 rounded-[10px]" />
            </div>
            <div className="grid grid-cols-3 gap-x-6 gap-y-5 px-5 py-5">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-2 h-3.5 w-28" />
                </div>
              ))}
            </div>
          </CardSkeleton>
          <CardSkeleton>
            <div className="flex items-center justify-between border-b border-navy-06 px-5 py-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-7 w-28 rounded-[10px]" />
            </div>
            <TableSkeleton rows={2} cols={3} />
          </CardSkeleton>
        </div>
        <div className="grid content-start gap-4">
          <CardSkeleton className="px-5 py-5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="mt-3.5 h-7 w-36" />
            <Skeleton className="mt-3 h-3 w-32" />
          </CardSkeleton>
          {[4, 3].map((rows, i) => (
            <CardSkeleton key={i}>
              <div className="border-b border-navy-06 px-5 py-4">
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="space-y-3 px-5 py-5">
                {Array.from({ length: rows }, (_, r) => (
                  <div key={r} className="flex justify-between gap-4">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3.5 w-12" />
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
