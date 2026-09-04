import { formatDistanceToNowStrict } from "date-fns";
import { NavLink } from "./nav-link";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/employees", label: "Employees" },
  { href: "/attendance", label: "Attendance" },
  { href: "/holidays", label: "Holidays" },
  { href: "/advances", label: "Advances" },
  { href: "/payroll", label: "Payroll" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
] as const;

export function Sidebar({ lastBackupAt }: { lastBackupAt: string | null }) {
  const backup = lastBackupAt
    ? formatDistanceToNowStrict(new Date(lastBackupAt), { addSuffix: true })
    : "never";
  return (
    <aside className="sticky top-0 flex h-screen flex-col bg-navy px-3 py-6 text-chalk">
      <div className="px-3.5 pb-6">
        <div className="text-[15px] font-semibold">NA Office HR</div>
        <div className="mt-0.5 text-[11px] text-chalk/50">Internal · v0.1</div>
      </div>
      <nav className="flex flex-col">
        {NAV.map((n) => (
          <NavLink key={n.href} href={n.href}>
            {n.label}
          </NavLink>
        ))}
        <div className="mx-3.5 my-3.5 h-px bg-chalk/10" />
        <NavLink href="/checkin" external>
          Check-in page ↗
        </NavLink>
      </nav>
      <div className="mt-auto border-t border-chalk/10 px-3.5 pt-4 text-xs text-chalk/50">
        Last backup <b className="font-medium text-chalk">{backup}</b>
      </div>
    </aside>
  );
}
