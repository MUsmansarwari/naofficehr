"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      className={cn(
        "relative my-0.5 flex items-center gap-2.5 rounded-[10px] py-2.5 pl-7 pr-3.5 text-[13.5px] text-chalk/70 hover:bg-white/5 hover:text-chalk",
        active && "bg-white/8 font-medium text-chalk",
      )}
    >
      {active && (
        <span className="absolute left-3 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-amber" />
      )}
      {children}
    </Link>
  );
}
