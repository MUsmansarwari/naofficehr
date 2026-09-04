"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, createSession, destroySession } from "@/lib/auth";
import { COMPANY_COOKIE } from "@/lib/company";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  if (!checkPassword(password)) {
    return { error: "Wrong password" };
  }
  await createSession();
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function switchCompany(companyId: number) {
  const jar = await cookies();
  jar.set(COMPANY_COOKIE, String(companyId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
}
