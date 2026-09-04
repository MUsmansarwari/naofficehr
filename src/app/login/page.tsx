import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · NA Office HR" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-chalk p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-card">
        <div className="text-xs uppercase tracking-wider text-navy-45">NA Office HR</div>
        <h1 className="mt-1 text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-navy-70">Internal tool — one password for the manager.</p>
        <LoginForm next={next ?? "/"} />
      </div>
    </main>
  );
}
