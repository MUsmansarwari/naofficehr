import { CardSkeleton, HeaderSkeleton, PillsSkeleton, TableSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <PillsSkeleton count={4} />
      <CardSkeleton>
        <TableSkeleton rows={6} cols={6} />
      </CardSkeleton>
    </>
  );
}
