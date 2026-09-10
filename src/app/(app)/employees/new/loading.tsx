import { CardSkeleton, HeaderSkeleton, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton actions={0} back />
      <CardSkeleton className="max-w-4xl">
        <div className="space-y-6 px-5 py-5">
          {[6, 6, 3].map((count, s) => (
            <div key={s} className="grid grid-cols-3 gap-4">
              {Array.from({ length: count }, (_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2 h-9 rounded-[10px]" />
                </div>
              ))}
            </div>
          ))}
          <div className="flex justify-end">
            <Skeleton className="h-9 w-32 rounded-[10px]" />
          </div>
        </div>
      </CardSkeleton>
    </>
  );
}
