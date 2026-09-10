import { HeaderSkeleton, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton actions={3} back />
      <div className="mx-auto max-w-3xl rounded-2xl bg-white px-11 py-10 shadow-card">
        <div className="mb-5 flex items-start justify-between border-b-2 border-navy-12 pb-4">
          <div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
          <div className="flex flex-col items-end">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-2 h-3 w-44" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-3.5 w-32" />
            </div>
          ))}
        </div>
        {[7, 4].map((rows, s) => (
          <div key={s} className="mt-7">
            <Skeleton className="mb-3 h-3 w-24" />
            {Array.from({ length: rows }, (_, r) => (
              <div key={r} className="flex justify-between border-b border-navy-06 py-2.5">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3.5 w-16" />
              </div>
            ))}
          </div>
        ))}
        <div className="mt-5 flex items-center justify-between border-t-2 border-navy-12 pt-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-36" />
        </div>
      </div>
    </>
  );
}
