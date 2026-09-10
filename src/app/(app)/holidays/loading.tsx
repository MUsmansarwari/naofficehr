import { CardSkeleton, HeaderSkeleton, PillsSkeleton, Skeleton, TableSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton actions={2} />
      <PillsSkeleton count={3} />
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <CardSkeleton>
          <div className="flex items-center justify-between border-b border-navy-06 px-5 py-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-72" />
          </div>
          <TableSkeleton rows={7} cols={4} />
        </CardSkeleton>
        <div className="grid content-start gap-4">
          <CardSkeleton>
            <div className="border-b border-navy-06 px-5 py-4">
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="space-y-4 px-5 py-4">
              <Skeleton className="h-9 rounded-[10px]" />
              <Skeleton className="h-9 rounded-[10px]" />
              <Skeleton className="h-9 rounded-[10px]" />
            </div>
          </CardSkeleton>
          <CardSkeleton>
            <div className="border-b border-navy-06 px-5 py-4">
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="space-y-2 px-5 py-4">
              <Skeleton className="h-3.5" />
              <Skeleton className="h-3.5" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          </CardSkeleton>
        </div>
      </div>
    </>
  );
}
