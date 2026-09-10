import { CardSkeleton, HeaderSkeleton, Skeleton, TableSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton actions={3} />
      {[8, 9].map((cols, i) => (
        <CardSkeleton key={i} className={i === 0 ? "mb-5" : undefined}>
          <div className="flex items-center justify-between border-b border-navy-06 px-5 py-4">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-7 w-24 rounded-[10px]" />
          </div>
          <TableSkeleton rows={3} cols={cols} />
        </CardSkeleton>
      ))}
    </>
  );
}
