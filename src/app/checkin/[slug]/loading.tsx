import { Skeleton } from "@/components/skeleton";

/** Same card, same keypad footprint — the real page drops in without a jump. */
export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-chalk p-6">
      <div className="w-full max-w-[340px] rounded-3xl bg-white px-6 py-7 text-center shadow-card">
        <Skeleton className="mx-auto mb-3 size-10 rounded-full" />
        <Skeleton className="mx-auto h-3 w-24" />
        <Skeleton className="mx-auto mb-5 mt-3 h-5 w-36" />
        <div className="mb-6 flex justify-center gap-3.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="size-3.5 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="h-[62px] rounded-[14px]" />
          ))}
        </div>
        <Skeleton className="mx-auto mt-4 h-3.5 w-40" />
      </div>
    </main>
  );
}
