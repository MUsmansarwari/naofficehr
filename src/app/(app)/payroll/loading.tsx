import { CardSkeleton, HeaderSkeleton, Skeleton, TableSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton actions={4} />
      <CardSkeleton>
        <div className="flex flex-wrap gap-9 border-b border-navy-06 px-5 py-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-4 w-24" />
            </div>
          ))}
        </div>
        <TableSkeleton rows={4} cols={9} />
      </CardSkeleton>
    </>
  );
}
