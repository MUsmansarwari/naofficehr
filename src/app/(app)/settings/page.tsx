import { PageHeader } from "@/components/page-header";
import { db, schema } from "@/db";
import { Card, CardBody, CardHeader } from "@/components/card";
import { getActiveCompany, listCompanies } from "@/lib/company";
import { BackupCard } from "./backup-card";
import { CompanyForm } from "./company-form";
import { NewCompanyDialog } from "./new-company-dialog";

export default async function SettingsPage() {
  const [companies, active, settingsRow] = await Promise.all([
    listCompanies(),
    getActiveCompany(),
    db.select().from(schema.settings).limit(1),
  ]);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle={active ? `Editing ${active.name} — switch company from the top bar` : "Add your first company"}
        actions={<NewCompanyDialog />}
      />
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        {active ? (
          <CompanyForm key={active.id} company={active} />
        ) : (
          <Card>
            <CardBody className="text-navy-70">No company yet. Use “Add company”.</CardBody>
          </Card>
        )}
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader title="Companies" />
            <ul className="divide-y divide-navy-06">
              {companies.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-navy-45">/checkin/{c.slug}</div>
                  </div>
                  {c.id === active?.id && <span className="text-xs text-navy-70">Active</span>}
                </li>
              ))}
            </ul>
          </Card>
          <BackupCard lastBackupAt={settingsRow[0]?.lastBackupAt ?? null} />
        </div>
      </div>
    </>
  );
}
