import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-2xl bg-white shadow-card", className)} {...props} />;
}

export function CardHeader({
  title,
  right,
  className,
}: {
  title: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between border-b border-navy-06 px-5 py-4", className)}>
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {right}
    </div>
  );
}

export function CardBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 py-5", className)} {...props} />;
}
