import type { ZodError } from "zod";

/** Shared shape for useActionState forms. */
export type FormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /**
   * What was submitted, echoed back. React resets an uncontrolled form once its
   * action resolves, so without this a validation error wipes everything typed.
   */
  values?: Record<string, string>;
};

/** Flattens a FormData into strings; repeated keys join with a comma. */
export function formValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of new Set(fd.keys())) out[key] = fd.getAll(key).map(String).join(",");
  return out;
}

export function fromZod(err: ZodError, fd?: FormData): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: "Please fix the highlighted fields", fieldErrors, values: fd ? formValues(fd) : undefined };
}

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

export function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}
