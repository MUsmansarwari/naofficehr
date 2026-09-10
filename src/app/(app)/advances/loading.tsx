import { CardSkeleton, HeaderSkeleton, TableSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <CardSkeleton>
        <TableSkeleton rows={4} cols={8} />
      </CardSkeleton>
    </>
  );
}
