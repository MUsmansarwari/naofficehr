import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { getActiveCompany, listCompanies } from "@/lib/company";
import { db, schema } from "@/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [companies, active, settingsRow] = await Promise.all([
    listCompanies(),
    getActiveCompany(),
    db.select().from(schema.settings).limit(1),
  ]);
  const lastBackupAt = settingsRow[0]?.lastBackupAt ?? null;

  return (
    <div className="app-shell grid min-h-screen grid-cols-[232px_1fr]">
      <Sidebar lastBackupAt={lastBackupAt} checkinSlug={active?.slug ?? null} />
      <div className="min-w-0">
        <Topbar companies={companies} active={active} />
        <main className="app-main px-8 pb-14 pt-5">{children}</main>
      </div>
    </div>
  );
}
