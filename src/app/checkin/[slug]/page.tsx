import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { to12h } from "@/lib/dates";
import { CheckinClient } from "./checkin-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [c] = await db.select({ name: schema.companies.name }).from(schema.companies).where(eq(schema.companies.slug, slug)).limit(1);
  return { title: c ? `Check-in · ${c.name}` : "Check-in" };
}

export default async function CheckinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [company] = await db.select().from(schema.companies).where(eq(schema.companies.slug, slug)).limit(1);
  if (!company) notFound();

  return (
    <main className="grid min-h-screen place-items-center bg-chalk p-6">
      <div className="w-full max-w-[340px]">
        <CheckinClient slug={slug} companyName={company.name} enabled={company.checkinEnabled} shift={`${to12h(company.shiftStart)} – ${to12h(company.shiftEnd)}`} />
      </div>
    </main>
  );
}
