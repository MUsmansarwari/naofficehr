"use client";

import Link, { useLinkStatus } from "next/link";
import { Spinner } from "@/components/skeleton";
import { cn } from "@/lib/utils";

/**
 * Shows a spinner the moment a link is clicked, before the new page's skeleton
 * arrives. useLinkStatus only reports for the Link it is rendered inside.
 */
function Status({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <Spinner className={cn("text-current", className)} />;
}

type Props = React.ComponentProps<typeof Link> & {
  /** Replace the children with just a spinner while navigating (icon buttons). */
  swap?: boolean;
  spinnerClassName?: string;
};

export function PendingLink({ children, className, swap, spinnerClassName, ...rest }: Props) {
  return (
    <Link className={cn("inline-flex items-center justify-center gap-1.5", className)} {...rest}>
      {swap ? <SwapContent spinnerClassName={spinnerClassName}>{children}</SwapContent> : children}
      {!swap && <Status className={spinnerClassName} />}
    </Link>
  );
}

function SwapContent({ children, spinnerClassName }: { children: React.ReactNode; spinnerClassName?: string }) {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className={cn("text-current", spinnerClassName)} /> : <>{children}</>;
}

export { Status as LinkPendingIndicator };
