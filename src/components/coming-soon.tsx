import { PageHeader } from "@/components/page-header";

export function ComingSoon({ title, phase }: { title: string; phase: number }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="rounded-2xl bg-white p-6 text-navy-70 shadow-card">Built in Phase {phase}.</div>
    </>
  );
}
