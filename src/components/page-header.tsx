import { ArrowLeft } from "lucide-react";
import { PendingLink } from "@/components/pending-link";

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Shown above the title on pages you drill into, so there is a way out. */
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {back && (
          <PendingLink
            href={back.href}
            className="-ml-1.5 mb-1.5 gap-1.5 rounded-md px-1.5 py-0.5 text-[13px] text-navy-70 transition-colors hover:bg-white hover:text-navy"
          >
            <ArrowLeft className="size-3.5" />
            {back.label}
          </PendingLink>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-1 text-navy-70">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
