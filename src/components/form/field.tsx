import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs text-navy-70">
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-red">{error}</p> : hint ? <p className="text-xs text-navy-45">{hint}</p> : null}
    </div>
  );
}

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-lg border border-soft bg-white px-3 text-sm text-navy outline-none focus-visible:border-amber focus-visible:ring-2 focus-visible:ring-amber/40 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Checkbox({ label, className, ...props }: React.ComponentProps<"input"> & { label: React.ReactNode }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm", className)}>
      <input type="checkbox" className="size-4 accent-amber" {...props} />
      {label}
    </label>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="rounded-lg bg-red-12 px-3 py-2 text-sm text-red">{message}</p>;
}

export function FormOk({ show, text = "Saved" }: { show?: boolean; text?: string }) {
  if (!show) return null;
  return <p className="text-sm text-navy-70">{text}</p>;
}
