import { cn } from "@/lib/utils";

const styles = {
  default: "bg-chalk text-navy-70",
  probation: "bg-soft text-navy",
  locked: "bg-navy text-chalk",
  red: "bg-red-12 text-red",
} as const;

export function Tag({
  variant = "default",
  className,
  ...props
}: React.ComponentProps<"span"> & { variant?: keyof typeof styles }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 align-middle text-[11px] font-medium",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
