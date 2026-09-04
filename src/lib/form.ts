import type { ZodError } from "zod";

/** Shared shape for useActionState forms. */
export type FormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export function fromZod(err: ZodError): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: "Please fix the highlighted fields", fieldErrors };
}

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

export function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}
